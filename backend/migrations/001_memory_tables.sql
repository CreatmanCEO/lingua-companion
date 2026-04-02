-- Migration 001: Memory tables for LinguaCompanion
-- Run against Supabase PostgreSQL
-- Requires: pgvector extension

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- User facts: key-value store for user profile data
-- (name, level, specialty, interests, etc.)
CREATE TABLE IF NOT EXISTS user_facts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, key)
);

-- Memory vectors: embeddings for semantic search
-- (conversation snippets, session summaries)
CREATE TABLE IF NOT EXISTS memory_vectors (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    text TEXT NOT NULL,
    embedding vector(768) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- HNSW index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS idx_memory_vectors_embedding
    ON memory_vectors
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Index for user_id filtering
CREATE INDEX IF NOT EXISTS idx_memory_vectors_user_id
    ON memory_vectors (user_id);

-- Vocabulary gaps: track repeated errors per word
CREATE TABLE IF NOT EXISTS vocab_gaps (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'default',
    word TEXT NOT NULL,
    correct_form TEXT,
    error_count INTEGER NOT NULL DEFAULT 1,
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, word)
);

-- Index for quick lookup of user's vocab gaps
CREATE INDEX IF NOT EXISTS idx_vocab_gaps_user_id
    ON vocab_gaps (user_id);
