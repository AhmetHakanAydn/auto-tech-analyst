"""
============================================================
 Optimized by Skills Agent: Database setup for RAG pgvector
============================================================
Creates the `code_embeddings` table (1536-dim vectors) and the
pgvector extension in Supabase. Idempotent: safe to re-run.

# AI-OPT: Bootstrapping pgvector schema for RAG retrieval
#         (model: claude-opus-4-7, date: 2026-05-06)
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client


SCHEMA_SQL = """
create extension if not exists vector;

create table if not exists public.code_embeddings (
    id          bigserial primary key,
    project_id  text       not null,
    file_path   text       not null,
    code_content text      not null,
    embedding   vector(1536)
);

create index if not exists code_embeddings_project_idx
    on public.code_embeddings (project_id);

create index if not exists code_embeddings_embedding_idx
    on public.code_embeddings
    using ivfflat (embedding vector_cosine_ops)
    with (lists = 100);
"""


def get_client() -> Client:
    load_dotenv()
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment (.env)."
        )
    return create_client(url, key)


def run_schema(client: Client) -> None:
    """
    Execute DDL via the `exec_sql` Postgres function.

    Supabase REST does not expose raw DDL, so this relies on a one-time
    helper function in the database:

        create or replace function exec_sql(sql text) returns void
        language plpgsql as $$ begin execute sql; end; $$;

    If the RPC is missing, we print the SQL so the operator can run it
    once in the Supabase SQL editor.
    """
    try:
        client.rpc("exec_sql", {"sql": SCHEMA_SQL}).execute()
        print("[ok] code_embeddings schema applied.")
    except Exception as exc:
        print(f"[warn] RPC exec_sql failed: {exc}")
        print("[info] Run this SQL once in the Supabase SQL editor:\n")
        print(SCHEMA_SQL)
        raise


def main() -> int:
    try:
        client = get_client()
        run_schema(client)
        return 0
    except RuntimeError as exc:
        print(f"[error] {exc}")
        return 1
    except Exception as exc:
        print(f"[error] unexpected failure: {exc}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
