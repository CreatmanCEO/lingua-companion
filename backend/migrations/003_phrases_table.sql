CREATE TABLE IF NOT EXISTS saved_phrases (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    style TEXT,          -- simple/professional/colloquial/slang/idiom
    context TEXT,        -- usage context
    translation TEXT,    -- Russian translation
    source_message TEXT, -- original user message that generated this
    ease_factor FLOAT DEFAULT 2.5,
    interval_days INT DEFAULT 1,
    repetitions INT DEFAULT 0,
    next_review TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phrases_user ON saved_phrases(user_id);
CREATE INDEX IF NOT EXISTS idx_phrases_review ON saved_phrases(user_id, next_review);
