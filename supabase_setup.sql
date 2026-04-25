-- ============================================================
-- The AI Scientist — Supabase setup
-- Run this entire file in the Supabase SQL Editor once.
-- ============================================================

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at       TIMESTAMPTZ DEFAULT now(),
  experiment_question TEXT     NOT NULL,
  category         TEXT        NOT NULL
    CHECK (category IN ('protocol', 'material', 'budget', 'timeline', 'validation')),
  item_label       TEXT        NOT NULL DEFAULT '',   -- human-readable label, e.g. "Step 3" or "GelMA"
  original_text    TEXT        NOT NULL,
  corrected_text   TEXT        NOT NULL,
  comment          TEXT        DEFAULT '',
  embedding        VECTOR(1536)                        -- text-embedding-3-small
);

-- 3. IVFFlat index for cosine similarity (rebuild after ~1000 rows with LISTS=100)
CREATE INDEX IF NOT EXISTS feedback_embedding_idx
  ON feedback USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- 4. Similarity search function
CREATE OR REPLACE FUNCTION match_feedback(
  query_embedding  VECTOR(1536),
  match_threshold  FLOAT   DEFAULT 0.70,
  match_count      INT     DEFAULT 6
)
RETURNS TABLE (
  id             UUID,
  category       TEXT,
  item_label     TEXT,
  original_text  TEXT,
  corrected_text TEXT,
  comment        TEXT,
  similarity     FLOAT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id,
    category,
    item_label,
    original_text,
    corrected_text,
    comment,
    1 - (embedding <=> query_embedding) AS similarity
  FROM feedback
  WHERE 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
