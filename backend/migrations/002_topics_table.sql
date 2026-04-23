CREATE TABLE IF NOT EXISTS topics (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL DEFAULT 'anonymous',
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    discussion_prompt TEXT,
    source TEXT NOT NULL,  -- 'hn' or 'reddit'
    seen BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topics_user_unseen ON topics(user_id, seen, created_at DESC);
