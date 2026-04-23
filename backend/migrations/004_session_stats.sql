CREATE TABLE IF NOT EXISTS session_stats (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    session_date DATE DEFAULT CURRENT_DATE,
    duration_sec INT DEFAULT 0,
    message_count INT DEFAULT 0,
    error_count INT DEFAULT 0,
    error_breakdown JSONB DEFAULT '{}',
    words_learned INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_stats_user ON session_stats(user_id, session_date DESC);
