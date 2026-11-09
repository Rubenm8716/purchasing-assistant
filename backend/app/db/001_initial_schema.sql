
-- 001_initial_schema.sql
-- Initial employee authentication and chat tables

-- TABLE 1: USERS
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'employee'
        CHECK (role IN ('employee', 'manager', 'admin')),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- TABLE 2: SESSIONS
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    token_hash TEXT NOT NULL UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,

    CHECK (expires_at > created_at)
);


-- TABLE 3: CONVERSATIONS
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    title VARCHAR(255) NOT NULL DEFAULT 'New conversation',

    title_source VARCHAR(20) NOT NULL DEFAULT 'default'
        CHECK (title_source IN ('default', 'generated', 'manual')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    archived_at TIMESTAMPTZ
);


-- TABLE 4: MESSAGES
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    conversation_id UUID NOT NULL
        REFERENCES conversations(id) ON DELETE RESTRICT,

    role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant')),

    content TEXT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- INDEXES
CREATE INDEX idx_sessions_user
ON sessions(user_id);

CREATE INDEX idx_conversations_user
ON conversations(user_id, updated_at DESC);

CREATE INDEX idx_messages_conversation
ON messages(conversation_id, created_at, id);
