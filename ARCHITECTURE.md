# ARCHITECTURE — Autonomous Technical Analysis System

## 1. Purpose
An autonomous agent that ingests a feature request (mandatory text prompt + optional screenshot), retrieves relevant context from a target codebase via RAG, and emits paired **Frontend + Backend** Jira tasks. Every AI-optimized code path is annotated for traceability.

## 2. Tech Stack

| Layer | Tool | Role |
|---|---|---|
| Frontend | **Next.js 14** (App Router, TS, Tailwind) | Prompt UI, screenshot upload, task preview |
| Backend | **FastAPI** (Python 3.11) | Orchestration, RAG pipeline, Jira sync |
| Vector DB | **Supabase (pgvector)** | Codebase embeddings + metadata |
| Auth/Storage | **Supabase Auth + Storage** | User sessions, screenshot blobs |
| LLM Orchestration | **LangChain** | Retriever, prompt chains, multimodal handling |
| Issue Tracker | **Atlassian Jira REST API v3** | Task creation (FE + BE) |

## 3. High-Level Flow

```
User → Next.js → FastAPI /analyze
                    ├─ Vision parse (screenshot, optional)
                    ├─ LangChain retriever → Supabase pgvector
                    ├─ Plan Agent (LLM) → {frontend_task, backend_task}
                    └─ Jira API → 2 issues created
                                      → returns links to UI
```

**Hard rule:** the Plan Agent output schema requires both `frontend_task` and `backend_task`. Validation rejects single-sided output and retries.

## 4. Repository Layout

```
auto-tech-analyst/
├── frontend/              # Next.js app
│   ├── app/
│   ├── components/
│   └── lib/api.ts
├── backend/               # FastAPI service
│   ├── app/
│   │   ├── routes/        # /analyze, /ingest, /health
│   │   ├── agents/        # plan_agent, retriever
│   │   ├── rag/           # chunker, embedder, supabase client
│   │   ├── integrations/  # jira_client, vision_client
│   │   └── schemas/       # Pydantic models
│   └── pyproject.toml
├── supabase/
│   └── migrations/        # pgvector schema
└── ARCHITECTURE.md
```

## 5. RAG Pipeline

1. **Ingest** target repo → AST-aware chunking (code-splitter) → embeddings (`text-embedding-3-small`) → `code_chunks(embedding vector(1536), path, lang, symbol, content)`.
2. **Retrieve** top-k via cosine similarity, filtered by language/path heuristics inferred from the prompt.
3. **Augment** prompt with retrieved snippets + (optional) vision-parsed UI description.

## 6. Plan Agent Contract

Input: `{ prompt: str, screenshot_url?: str, repo_id: str }`
Output (strict JSON, validated):
```json
{
  "frontend_task": { "summary", "description", "acceptance_criteria", "labels" },
  "backend_task":  { "summary", "description", "acceptance_criteria", "labels" },
  "shared_context": "string"
}
```
Both tasks are mandatory. The Jira client links them via `relates to`.

## 7. AI Traceability

Every code block produced or optimized by AI must carry a marker:
```
# AI-OPT: <short rationale> (model: <name>, date: YYYY-MM-DD)
```
Applies to backend Python, frontend TS/TSX, and SQL migrations. Lint rule (custom) verifies presence on AI-touched diffs.

## 8. GitHub Flow

- `main` is always deployable.
- Feature branches: `feature/<scope>` (e.g. current `feature/initial-setup`).
- PRs require: passing CI, AI-traceability check, and ARCHITECTURE.md update if contracts change.
- Squash-merge to `main`; auto-deploy on merge.

## 9. Configuration

Secrets via `.env` (already created): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `OPENAI_API_KEY`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEY`.

## 10. Out of Scope (this phase)
No functional code yet. Next phase: scaffold `frontend/` and `backend/` skeletons + Supabase migration for `code_chunks`.
