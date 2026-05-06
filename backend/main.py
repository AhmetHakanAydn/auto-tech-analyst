"""
============================================================
 Optimized by Skills Agent: FastAPI /analyze-task endpoint
============================================================
RAG-augmented Plan Agent. Embeds the manager prompt with
OpenAI text-embedding-3-small (1536-dim, matches schema),
ranks code_embeddings rows for project_id='todo-app-1' by
cosine similarity, then calls Claude with retrieved context
and (optional) screenshot. Response schema is enforced.

Per ARCHITECTURE §6 the Plan Agent MUST emit both frontend
and backend task arrays — single-sided output is rejected
and retried once.

# AI-OPT: client-side cosine ranking (small corpus) avoids a
#   second pgvector RPC dependency and stays self-contained
#   (model: claude-opus-4-7, date: 2026-05-06)
# AI-OPT: defensive JSON extraction strips accidental ```json
#   fences and falls back to greedy {...} match before erroring
#   (model: claude-opus-4-7, date: 2026-05-06)
# AI-OPT: lazy singletons for Supabase / OpenAI / Anthropic
#   clients keep cold-start cheap and let /health pass without
#   all keys present
#   (model: claude-opus-4-7, date: 2026-05-06)
# AI-OPT: Jira issue creation is best-effort and isolated per
#   task — any formatting / network / auth failure is logged
#   and recorded on the response instead of crashing the call,
#   so the analyst output is never lost
#   (model: claude-opus-4-7, date: 2026-05-06)
# AI-OPT: product-oriented ticket schema — each task carries
#   only {title, description}. Description is Markdown with a
#   user-centric story line followed by a 'Teknik Analiz
#   Notları' section. Frontend tasks include UI Davranışı /
#   Alanlar / State Yönetimi; backend tasks include
#   Swagger/Endpoint and Request/Response JSON samples. No
#   file paths, no tutorial prose.
#   (model: claude-opus-4-7, date: 2026-05-06)
"""

import os
import re
import json
import base64
import logging
from typing import Optional

import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from supabase import create_client, Client
from langchain_openai import OpenAIEmbeddings
from anthropic import Anthropic
from atlassian import Jira


load_dotenv()

PROJECT_ID = "todo-app-1"
TOP_K = 3
EMBED_MODEL = "text-embedding-3-small"
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
MAX_TOKENS = 8192
ROW_FETCH_LIMIT = 2000

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("analyze-task")


# ---------- lazy clients ----------

_supabase: Optional[Client] = None
_embedder: Optional[OpenAIEmbeddings] = None
_claude: Optional[Anthropic] = None
_jira: Optional[Jira] = None


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise HTTPException(status_code=500, detail=f"server misconfigured: missing {key}")
    return val


def supabase_client() -> Client:
    global _supabase
    if _supabase is None:
        _supabase = create_client(_require("SUPABASE_URL"), _require("SUPABASE_SERVICE_KEY"))
    return _supabase


def embedder() -> OpenAIEmbeddings:
    global _embedder
    if _embedder is None:
        _embedder = OpenAIEmbeddings(model=EMBED_MODEL, api_key=_require("OPENAI_API_KEY"))
    return _embedder


def claude_client() -> Anthropic:
    global _claude
    if _claude is None:
        _claude = Anthropic(api_key=_require("ANTHROPIC_API_KEY"))
    return _claude


def jira_client() -> Jira:
    global _jira
    if _jira is None:
        _jira = Jira(
            url=_require("JIRA_BASE_URL"),
            username=_require("JIRA_EMAIL"),
            password=_require("JIRA_API_TOKEN"),
            cloud=True,
        )
    return _jira


# ---------- schemas ----------

class TaskItem(BaseModel):
    title: str
    description: str


class AnalyzeRequest(BaseModel):
    manager_prompt: str = Field(..., min_length=1)
    image_base64: Optional[str] = None


class CreatedIssue(BaseModel):
    side: str
    summary: str
    key: Optional[str] = None
    url: Optional[str] = None
    error: Optional[str] = None


class AnalyzeResponse(BaseModel):
    frontend_tasks: list[TaskItem]
    backend_tasks: list[TaskItem]
    jira_issues: list[CreatedIssue]


# ---------- retrieval ----------

def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    na = float(np.linalg.norm(a))
    nb = float(np.linalg.norm(b))
    if na == 0.0 or nb == 0.0:
        return 0.0
    return float(np.dot(a, b) / (na * nb))


def _coerce_embedding(emb) -> Optional[np.ndarray]:
    if emb is None:
        return None
    if isinstance(emb, str):
        try:
            emb = json.loads(emb)
        except Exception:
            return None
    try:
        return np.asarray(emb, dtype=np.float32)
    except Exception:
        return None


def retrieve_context(prompt: str, k: int = TOP_K) -> list[dict]:
    try:
        qvec = np.asarray(embedder().embed_query(prompt), dtype=np.float32)
    except Exception as exc:
        log.warning("embed query failed: %s", exc)
        return []

    try:
        rows = (
            supabase_client()
            .table("code_embeddings")
            .select("file_path,code_content,embedding")
            .eq("project_id", PROJECT_ID)
            .limit(ROW_FETCH_LIMIT)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        log.warning("supabase fetch failed: %s", exc)
        return []

    scored: list[tuple[float, dict]] = []
    for row in rows:
        vec = _coerce_embedding(row.get("embedding"))
        if vec is None or vec.shape != qvec.shape:
            continue
        scored.append((_cosine(qvec, vec), row))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [
        {"file_path": r["file_path"], "code_content": r["code_content"]}
        for _, r in scored[:k]
    ]


# ---------- LLM call ----------

PROMPT_TEMPLATE = """You are a Senior Full-Stack Technical Analyst writing Jira tickets for an expert engineering team.

Manager request:
{prompt}

Context (top {k} retrieved code chunks — for situational awareness only; DO NOT cite file paths or filenames in your output):
{context}

If an image is provided, treat it as additional product input.

CRITICAL RULE: You MUST output BOTH frontend and backend tasks.

Each task is product-oriented and uses this exact Markdown structure inside `description`:

═══ FRONTEND TASK FORMAT ═══
The first line is a user-centric story sentence in Turkish, e.g.
"Kullanıcıların todolar arasında öncelik belirleyebilmesi için bir dropdown eklenecektir."

Then:

## Teknik Analiz Notları

### UI Davranışı
- concise bullets describing user-visible behavior

### Alanlar
- bullets listing form fields / inputs / labels / validation hints

### State Yönetimi
- bullets describing local/global state shape, transitions, side effects

═══ BACKEND TASK FORMAT ═══
The first line is a user-centric story sentence in Turkish.

Then:

## Teknik Analiz Notları

### Swagger / Endpoint
- HTTP method, path, auth, status codes

### Request
```json
{{ "example": "payload" }}
```

### Response
```json
{{ "example": "payload" }}
```

### İş Kuralları
- bullets covering validation, idempotency, edge cases, business rules

═══ HARD RULES ═══
- DO NOT include file paths, filenames, or any "Target File" section.
- DO NOT include tutorial text or library hand-holding (no "use <Select> like this", no library install steps).
- Assume the reader is a senior engineer. Tone: professional, terse, declarative.
- The story sentence must be in Turkish and user-centric ("Kullanıcıların ...").
- Section headers and JSON code fences inside `description` are required.

JSON OUTPUT RULE — FINAL REMINDER:
Return ONLY a single raw JSON object of the form
{{
  "frontend_tasks": [{{ "title": "...", "description": "..." }}],
  "backend_tasks":  [{{ "title": "...", "description": "..." }}]
}}

Do NOT include any conversational filler, markdown code blocks (like ```json), or explanations.
Start your reply with `{{` and end it with `}}`. Nothing before, nothing after.
The `description` values themselves contain Markdown — that is expected and required.
Escape newlines as \\n inside the JSON string values so the outer JSON stays parseable.
"""

SYSTEM_PROMPT = (
    "You are a Senior Full-Stack Technical Analyst.\n\n"
    "OUTPUT CONTRACT — STRICT, NO EXCEPTIONS:\n"
    "1. Reply with a SINGLE raw JSON object and absolutely nothing else.\n"
    "2. Do NOT include any conversational filler "
    "('Sure!', 'Here is...', 'I will...', etc.).\n"
    "3. Do NOT wrap the response in markdown code fences "
    "(no ```json, no ```, no triple backticks at all).\n"
    "4. Do NOT add any prose, headers, or explanations before or after the JSON.\n"
    "5. The VERY FIRST character of your reply MUST be '{'.\n"
    "6. The VERY LAST character of your reply MUST be '}'.\n"
    "7. Both 'frontend_tasks' and 'backend_tasks' are MANDATORY and non-empty.\n\n"
    "Each task is {title, description}. The description IS Markdown — that is "
    "expected — with a Turkish user-centric story line followed by a "
    "'## Teknik Analiz Notları' section. Markdown inside the description "
    "string is fine; just escape newlines as \\n so the outer JSON stays valid. "
    "No file paths, no tutorial text, no library hand-holding."
)


def _format_context(chunks: list[dict]) -> str:
    if not chunks:
        return "(no relevant chunks retrieved)"
    return "\n\n".join(
        f"--- {c['file_path']} ---\n{c['code_content']}" for c in chunks
    )


def _build_image_block(image_b64: str) -> Optional[dict]:
    if not image_b64:
        return None
    raw = image_b64.strip()
    media_type = "image/png"
    m = re.match(r"data:(image/[\w.+-]+);base64,(.+)", raw, re.DOTALL)
    if m:
        media_type, raw = m.group(1), m.group(2)
    try:
        base64.b64decode(raw, validate=True)
    except Exception:
        log.warning("image_base64 not valid base64; ignoring")
        return None
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": raw},
    }


def _find_balanced_object(text: str) -> Optional[str]:
    """Scan text and return the first balanced JSON object substring.

    Walks character-by-character tracking brace depth. Properly skips over
    braces and quotes that appear inside JSON string literals (respects \\"
    escapes). Returns the substring starting at the first '{' and ending at
    its matching '}', or None if no balanced object exists.
    """
    n = len(text)
    start = -1
    depth = 0
    in_str = False
    escape = False

    for j in range(n):
        c = text[j]
        if start == -1:
            if c == "{":
                start = j
                depth = 1
            continue

        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == '"':
                in_str = False
            continue

        if c == '"':
            in_str = True
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return text[start : j + 1]

    return None


def _extract_json(text: str) -> Optional[dict]:
    """Robust extractor: tolerates conversational prefixes/suffixes and code
    fences, then falls back to a balanced-brace scan."""
    if not text:
        return None
    s = text.strip()

    # Strip a wrapping ```json ... ``` (or plain ``` ... ```) fence if present.
    fence = re.match(
        r"^```(?:json|JSON)?\s*\n?(.*?)\n?```\s*$",
        s,
        re.DOTALL,
    )
    if fence:
        s = fence.group(1).strip()

    # Direct parse — happy path when the model obeys the contract.
    try:
        return json.loads(s)
    except Exception:
        pass

    # Fallback: find the first balanced { ... } and try to parse it.
    blob = _find_balanced_object(s)
    if blob:
        try:
            return json.loads(blob)
        except Exception:
            log.warning(
                "balanced-brace blob failed to parse (len=%d, head=%r)",
                len(blob),
                blob[:120],
            )
            return None

    log.warning(
        "no JSON object found in response (len=%d, head=%r, tail=%r)",
        len(s),
        s[:120],
        s[-120:],
    )
    return None


def _validate_payload(data: dict) -> Optional[str]:
    if not isinstance(data, dict):
        return "response is not an object"
    for key in ("frontend_tasks", "backend_tasks"):
        v = data.get(key)
        if not isinstance(v, list) or len(v) == 0:
            return f"'{key}' must be a non-empty array"
        for i, item in enumerate(v):
            if not isinstance(item, dict):
                return f"{key}[{i}] is not an object"
            for fld in ("title", "description"):
                if not isinstance(item.get(fld), str) or not item[fld].strip():
                    return f"{key}[{i}].{fld} missing or empty"
            desc = item["description"]
            if "## Teknik Analiz Notları" not in desc:
                return f"{key}[{i}].description missing 'Teknik Analiz Notları' section"
    return None


def call_claude(prompt: str, chunks: list[dict], image_b64: Optional[str]) -> dict:
    user_text = PROMPT_TEMPLATE.format(prompt=prompt, k=TOP_K, context=_format_context(chunks))
    content: list[dict] = []
    img_block = _build_image_block(image_b64) if image_b64 else None
    if img_block:
        content.append(img_block)
    content.append({"type": "text", "text": user_text})

    last_err = "unknown"
    for attempt in range(2):
        try:
            resp = claude_client().messages.create(
                model=CLAUDE_MODEL,
                max_tokens=MAX_TOKENS,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": content}],
            )
            text = "".join(
                getattr(b, "text", "") for b in resp.content
                if getattr(b, "type", None) == "text"
            )
            data = _extract_json(text)
            err = _validate_payload(data) if data is not None else "no JSON object found"
            if err is None:
                return data  # type: ignore[return-value]
            last_err = err
            log.warning("attempt %d invalid: %s", attempt + 1, err)
            content = [{
                "type": "text",
                "text": user_text + (
                    "\n\nYour previous reply failed validation: "
                    f"{err}. Reply again with a single raw JSON object only."
                ),
            }]
        except Exception as exc:
            last_err = f"anthropic call failed: {exc}"
            log.warning("attempt %d error: %s", attempt + 1, exc)

    raise HTTPException(status_code=502, detail=f"plan agent failed: {last_err}")


# ---------- Jira sync ----------

SIDE_TAGS = {"frontend": "[Frontend]", "backend": "[Backend]"}


def _failed_issue(side: str, title: str, reason: str) -> CreatedIssue:
    summary = f"{SIDE_TAGS[side]} {title}".strip()
    return CreatedIssue(side=side, summary=summary, error=reason)


def create_jira_issues(
    frontend: list[TaskItem], backend: list[TaskItem]
) -> list[CreatedIssue]:
    pairs = [("frontend", t) for t in frontend] + [("backend", t) for t in backend]

    project_key = os.getenv("JIRA_PROJECT_KEY")
    if not project_key:
        log.error("jira disabled: JIRA_PROJECT_KEY not set")
        return [_failed_issue(side, t.title, "JIRA_PROJECT_KEY not set") for side, t in pairs]

    try:
        client = jira_client()
    except HTTPException as exc:
        reason = str(exc.detail)
        log.error("jira client init failed: %s", reason)
        return [_failed_issue(side, t.title, reason) for side, t in pairs]
    except Exception as exc:
        log.exception("jira client init unexpected error")
        return [_failed_issue(side, t.title, f"jira init: {exc}") for side, t in pairs]

    base_url = (os.getenv("JIRA_BASE_URL") or "").rstrip("/")
    out: list[CreatedIssue] = []
    for side, task in pairs:
        summary = f"{SIDE_TAGS[side]} {task.title}".strip()
        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "description": task.description,
            "issuetype": {"name": "Task"},
        }
        try:
            resp = client.create_issue(fields=fields)
            key = resp.get("key") if isinstance(resp, dict) else None
            url = f"{base_url}/browse/{key}" if (base_url and key) else None
            log.info("jira created %s for %s task %r", key or "?", side, task.title)
            out.append(CreatedIssue(side=side, summary=summary, key=key, url=url))
        except Exception as exc:
            log.error("jira create failed (%s task %r): %s", side, task.title, exc)
            out.append(CreatedIssue(side=side, summary=summary, error=str(exc)))
    return out


# ---------- app ----------

app = FastAPI(title="Auto Tech Analyst")

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"ok": True}


@app.post("/analyze-task", response_model=AnalyzeResponse)
def analyze_task(req: AnalyzeRequest) -> AnalyzeResponse:
    prompt = req.manager_prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="manager_prompt is required")

    chunks = retrieve_context(prompt)
    log.info("retrieved %d context chunks", len(chunks))

    data = call_claude(prompt, chunks, req.image_base64)

    try:
        frontend_tasks = [TaskItem(**t) for t in data["frontend_tasks"]]
        backend_tasks = [TaskItem(**t) for t in data["backend_tasks"]]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"response shape invalid: {exc}")

    try:
        jira_issues = create_jira_issues(frontend_tasks, backend_tasks)
    except Exception as exc:
        log.exception("jira sync crashed unexpectedly; returning analyst output without issues")
        jira_issues = [
            _failed_issue(side, t.title, f"jira sync crashed: {exc}")
            for side, items in (("frontend", frontend_tasks), ("backend", backend_tasks))
            for t in items
        ]

    return AnalyzeResponse(
        frontend_tasks=frontend_tasks,
        backend_tasks=backend_tasks,
        jira_issues=jira_issues,
    )
