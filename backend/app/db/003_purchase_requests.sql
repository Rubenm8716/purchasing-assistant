
-- 003_purchase_requests.sql
-- Purchase records shared by chat and direct form

CREATE TABLE purchase_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    conversation_id UUID
        REFERENCES conversations(id) ON DELETE RESTRICT,

    source VARCHAR(20) NOT NULL
        CHECK (source IN ('chat', 'form')),

    job_name TEXT NOT NULL,
    item_description TEXT NOT NULL,
    reason TEXT NOT NULL,

    amount NUMERIC(12, 2) NOT NULL
        CHECK (amount >= 0),

    recommendation VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (recommendation IN (
            'pending',
            'recommended',
            'not_recommended',
            'needs_review'
        )),

    status VARCHAR(30) NOT NULL DEFAULT 'requested'
        CHECK (status IN (
            'requested',
            'purchased',
            'cancelled'
        )),

    after_the_fact BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- CHECK (source <> 'chat' OR conversation_id IS NOT NULL),
    -- CHECK (status <> 'purchased' OR after_the_fact IN (TRUE, FALSE))
    CHECK (source <> 'chat' OR conversation_id IS NOT NULL)
);


CREATE TABLE purchase_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    purchase_request_id UUID NOT NULL
        REFERENCES purchase_requests(id) ON DELETE RESTRICT,

    evidence_type VARCHAR(30) NOT NULL
        CHECK (evidence_type IN ('receipt', 'item_photo')),

    file_name TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    content_type TEXT NOT NULL,

    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_purchase_requests_user
ON purchase_requests(user_id, created_at DESC);

CREATE INDEX idx_purchase_requests_conversation
ON purchase_requests(conversation_id);

CREATE INDEX idx_purchase_evidence_request
ON purchase_evidence(purchase_request_id);
