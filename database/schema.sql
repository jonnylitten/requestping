-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    subscription_status TEXT DEFAULT 'active',
    monthly_request_limit INTEGER DEFAULT 5
);

-- FOIA Requests table (VA-specific)
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- VA-specific office and record type
    va_office TEXT NOT NULL,           -- VBA, VHA, NCA, OIG, GENERAL
    va_office_name TEXT NOT NULL,      -- Full office name
    record_type TEXT NOT NULL,         -- Type of record (benefits, contracts, etc.)

    subject TEXT NOT NULL,
    description TEXT NOT NULL,

    -- VA-specific record details (per 38 CFR § 1.554)
    record_author TEXT,                -- Author of record (if known)
    record_recipient TEXT,             -- Recipient of record (if known)
    record_title TEXT,                 -- Title/name of record

    date_range_start DATE,
    date_range_end DATE,
    delivery_format TEXT DEFAULT 'electronic',
    request_fee_waiver BOOLEAN DEFAULT 0,
    waiver_reason TEXT,

    -- Contact info (VA requires return address)
    requester_phone TEXT,              -- Optional but recommended
    requester_email TEXT,              -- Optional but recommended

    status TEXT DEFAULT 'pending',
    tracking_number TEXT,
    submitted_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Request status can be: pending, submitted, processing, completed, rejected

-- Documents table (for received FOIA documents)
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Activity log for tracking request communications
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES requests(id)
);

-- Activity types: request_created, request_submitted, agency_acknowledged,
-- follow_up_sent, documents_received, request_completed

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
CREATE INDEX IF NOT EXISTS idx_documents_request_id ON documents(request_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_request_id ON activity_log(request_id);
