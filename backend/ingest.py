"""
============================================================
 Optimized by Skills Agent: Ingest target repo → pgvector
============================================================
Walks target-todo-app for .ts/.tsx, chunks via LangChain
(800 chars / 100 overlap), embeds with OpenAI
text-embedding-3-small (1536-dim, matches code_embeddings
schema), and bulk-inserts rows tagged project_id='todo-app-1'.

NOTE: Anthropic does not provide an embeddings API; per
ARCHITECTURE §5 we use OpenAI for embeddings. Swap to Voyage
if a non-OpenAI provider is required (vector dim will change).

# AI-OPT: chunk_size=800 / overlap=100 keeps most TS functions
#   intact while capping embed token cost for RAG testing
#   (model: claude-opus-4-7, date: 2026-05-06)
# AI-OPT: batch inserts in groups of 100 to avoid Supabase
#   payload limits and reduce round-trips
#   (model: claude-opus-4-7, date: 2026-05-06)
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
from supabase import create_client, Client


PROJECT_ID = "todo-app-1"
REPO_ROOT = Path(__file__).resolve().parents[1]
TARGET_DIR = REPO_ROOT / "target-todo-app"
CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
EMBED_MODEL = "text-embedding-3-small"
INSERT_BATCH = 100
SKIP_DIRS = {"node_modules", ".next", "dist", "build"}


def load_env() -> dict:
    load_dotenv()
    missing = [k for k in ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "OPENAI_API_KEY")
               if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing env vars: {', '.join(missing)}")
    return {k: os.environ[k] for k in
            ("SUPABASE_URL", "SUPABASE_SERVICE_KEY", "OPENAI_API_KEY")}


def collect_files(root: Path) -> list[Path]:
    if not root.exists():
        raise RuntimeError(f"Target directory not found: {root}")
    out: list[Path] = []
    for ext in ("ts", "tsx"):
        for p in root.rglob(f"*.{ext}"):
            if SKIP_DIRS.isdisjoint(p.parts):
                out.append(p)
    return out


def build_rows(files: list[Path], splitter, embedder) -> list[dict]:
    rows: list[dict] = []
    for fp in files:
        try:
            text = fp.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"[warn] read failed {fp}: {exc}")
            continue

        chunks = splitter.split_text(text)
        if not chunks:
            continue

        try:
            vectors = embedder.embed_documents(chunks)
        except Exception as exc:
            print(f"[error] embed failed {fp}: {exc}")
            continue

        rel = str(fp.relative_to(REPO_ROOT))
        for chunk, vec in zip(chunks, vectors):
            rows.append({
                "project_id": PROJECT_ID,
                "file_path": rel,
                "code_content": chunk,
                "embedding": vec,
            })
        print(f"[ok] {rel}: {len(chunks)} chunks")
    return rows


def insert_rows(client: Client, rows: list[dict]) -> None:
    for i in range(0, len(rows), INSERT_BATCH):
        batch = rows[i:i + INSERT_BATCH]
        try:
            client.table("code_embeddings").insert(batch).execute()
        except Exception as exc:
            raise RuntimeError(f"insert batch {i}-{i+len(batch)} failed: {exc}") from exc


def main() -> int:
    try:
        env = load_env()
        client = create_client(env["SUPABASE_URL"], env["SUPABASE_SERVICE_KEY"])
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=CHUNK_SIZE, chunk_overlap=CHUNK_OVERLAP
        )
        embedder = OpenAIEmbeddings(
            model=EMBED_MODEL, api_key=env["OPENAI_API_KEY"]
        )

        files = collect_files(TARGET_DIR)
        if not files:
            print(f"[warn] no .ts/.tsx files under {TARGET_DIR}")
            return 1
        print(f"[info] {len(files)} source files found")

        rows = build_rows(files, splitter, embedder)
        if not rows:
            print("[warn] nothing to insert")
            return 1

        insert_rows(client, rows)
        print(f"[done] inserted {len(rows)} rows for project_id={PROJECT_ID}")
        return 0

    except RuntimeError as exc:
        print(f"[error] {exc}")
        return 1
    except Exception as exc:
        print(f"[error] unexpected: {exc}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
