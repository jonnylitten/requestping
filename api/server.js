const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { getVAOffice, getAllRecordTypes } = require('./va-config');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const db = new sqlite3.Database(process.env.DB_PATH || './database/requestping.db', (err) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Promisify database methods
const dbGet = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const dbAll = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const dbRun = (sql, params) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

// Generate UUID
function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

// ==================== AUTH ROUTES ====================

// Sign up
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        // Check if user exists
        const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email already registered' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const userId = generateId();
        await dbRun(
            'INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)',
            [userId, email, passwordHash]
        );

        // Generate token
        const token = jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ token, user: { id: userId, email } });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user
        const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Update last login
        await dbRun('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

        // Generate token
        const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' });

        res.json({ token, user: { id: user.id, email: user.email } });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Failed to login' });
    }
});

// ==================== VA RECORD TYPES ROUTES ====================

// Get VA record types for frontend dropdown
app.get('/api/va-record-types', async (req, res) => {
    try {
        const recordTypes = getAllRecordTypes();
        res.json({ recordTypes });
    } catch (error) {
        console.error('Error fetching record types:', error);
        res.status(500).json({ error: 'Failed to fetch record types' });
    }
});

// Keep old /api/agencies endpoint for backwards compatibility
app.get('/api/agencies', async (req, res) => {
    try {
        const recordTypes = getAllRecordTypes();
        res.json({ agencies: recordTypes });
    } catch (error) {
        console.error('Error fetching agencies:', error);
        res.status(500).json({ error: 'Failed to fetch agencies' });
    }
});

// ==================== FOIA REQUESTS ROUTES ====================

// Get all requests for authenticated user
app.get('/api/requests', authenticateToken, async (req, res) => {
    try {
        const requests = await dbAll(
            `SELECT r.*,
                    COUNT(d.id) as documents_count
             FROM requests r
             LEFT JOIN documents d ON r.id = d.request_id
             WHERE r.user_id = ?
             GROUP BY r.id
             ORDER BY r.created_at DESC`,
            [req.user.userId]
        );

        res.json({ requests });
    } catch (error) {
        console.error('Error fetching requests:', error);
        res.status(500).json({ error: 'Failed to fetch requests' });
    }
});

// Create new VA FOIA request
app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        const {
            record_type,
            subject,
            description,
            record_author,
            record_recipient,
            record_title,
            date_range_start,
            date_range_end,
            delivery_format,
            request_fee_waiver,
            waiver_reason,
            requester_phone
        } = req.body;

        // Validate required fields
        if (!record_type || !subject || !description) {
            return res.status(400).json({ error: 'Missing required fields: record_type, subject, description' });
        }

        // Get user email for contact info
        const user = await dbGet('SELECT email, monthly_request_limit FROM users WHERE id = ?', [req.user.userId]);

        // Check user's monthly request limit
        const requestCount = await dbGet(
            `SELECT COUNT(*) as count FROM requests
             WHERE user_id = ?
             AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
            [req.user.userId]
        );

        if (requestCount.count >= user.monthly_request_limit) {
            return res.status(403).json({ error: 'Monthly request limit reached' });
        }

        // Route to correct VA office based on record type
        const vaOffice = getVAOffice(record_type);

        // Create request
        const requestId = generateId();
        await dbRun(
            `INSERT INTO requests (
                id, user_id, va_office, va_office_name, record_type,
                subject, description, record_author, record_recipient, record_title,
                date_range_start, date_range_end, delivery_format,
                request_fee_waiver, waiver_reason, requester_phone, requester_email,
                status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                requestId,
                req.user.userId,
                vaOffice.code,
                vaOffice.name,
                record_type,
                subject,
                description,
                record_author || null,
                record_recipient || null,
                record_title || null,
                date_range_start || null,
                date_range_end || null,
                delivery_format || 'electronic',
                request_fee_waiver ? 1 : 0,
                waiver_reason || null,
                requester_phone || null,
                user.email
            ]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (id, request_id, activity_type, description) VALUES (?, ?, ?, ?)',
            [generateId(), requestId, 'request_created', `VA FOIA request created for ${vaOffice.name}`]
        );

        // Submit request via email to VA office
        await submitVAFOIARequest(requestId, vaOffice, {
            subject,
            description,
            record_type,
            record_author,
            record_recipient,
            record_title,
            date_range_start,
            date_range_end,
            delivery_format,
            request_fee_waiver,
            waiver_reason,
            requester_phone,
            requester_email: user.email
        });

        res.json({
            id: requestId,
            message: `Request created and submitted to ${vaOffice.name}`,
            office: vaOffice.name,
            email: vaOffice.email
        });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Get specific request details
app.get('/api/requests/:id', authenticateToken, async (req, res) => {
    try {
        const request = await dbGet(
            'SELECT * FROM requests WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.userId]
        );

        if (!request) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const documents = await dbAll(
            'SELECT * FROM documents WHERE request_id = ?',
            [req.params.id]
        );

        const activity = await dbAll(
            'SELECT * FROM activity_log WHERE request_id = ? ORDER BY created_at DESC',
            [req.params.id]
        );

        res.json({ request, documents, activity });
    } catch (error) {
        console.error('Error fetching request:', error);
        res.status(500).json({ error: 'Failed to fetch request' });
    }
});

// ==================== EMAIL FUNCTIONS ====================

async function submitVAFOIARequest(requestId, vaOffice, requestDetails) {
    try {
        const emailBody = generateVAFOIAEmailBody(requestDetails, vaOffice);

        if (!vaOffice.email) {
            console.error('No email found for VA office:', vaOffice.code);
            return;
        }

        // Send email via Resend
        await resend.emails.send({
            from: process.env.FROM_EMAIL,
            to: vaOffice.email,
            subject: `FOIA Request: ${requestDetails.subject}`,
            text: emailBody
        });

        // Update request status
        await dbRun(
            `UPDATE requests
             SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [requestId]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (id, request_id, activity_type, description) VALUES (?, ?, ?, ?)',
            [generateId(), requestId, 'request_submitted', `Request submitted to ${vaOffice.name} (${vaOffice.email})`]
        );

        console.log(`VA FOIA request ${requestId} submitted to ${vaOffice.name}`);
    } catch (error) {
        console.error('Error submitting VA FOIA request:', error);
        throw error;
    }
}

function generateVAFOIAEmailBody(details, vaOffice) {
    const {
        subject,
        description,
        record_type,
        record_author,
        record_recipient,
        record_title,
        date_range_start,
        date_range_end,
        delivery_format,
        request_fee_waiver,
        waiver_reason,
        requester_phone,
        requester_email
    } = details;

    let body = `Freedom of Information Act Request

To Whom It May Concern:

This is a request under the Freedom of Information Act (5 U.S.C. § 552).

CONTACT INFORMATION:
RequestPing FOIA Service
Email: ${requester_email || process.env.FROM_EMAIL}`;

    if (requester_phone) {
        body += `
Phone: ${requester_phone}`;
    }

    body += `

RECORDS REQUESTED:

${description}`;

    // Add specific record details (per 38 CFR § 1.554)
    if (record_title) {
        body += `

Record Title/Name: ${record_title}`;
    }

    if (record_author) {
        body += `
Record Author: ${record_author}`;
    }

    if (record_recipient) {
        body += `
Record Recipient: ${record_recipient}`;
    }

    if (date_range_start && date_range_end) {
        body += `

DATE RANGE:
${date_range_start} to ${date_range_end}`;
    }

    body += `

RECORD TYPE:
${record_type.replace(/_/g, ' ').toUpperCase()}`;

    body += `

DELIVERY FORMAT:
I request that responsive records be provided in ${
        delivery_format === 'electronic'
            ? 'electronic format (PDF)'
            : delivery_format === 'paper'
            ? 'paper format'
            : 'either electronic or paper format'
    }.`;

    if (request_fee_waiver) {
        body += `

FEE WAIVER REQUEST:
I request a waiver of all fees for this request. ${waiver_reason}`;
    } else {
        body += `

FEES:
Please notify me before processing this request if fees are expected to exceed $25.00. I agree to pay fees up to that amount.`;
    }

    body += `

Please acknowledge receipt of this request and provide a tracking number if available.

As required by 38 CFR § 1.554, this request contains sufficient detail to allow VA personnel to locate the records with a reasonable amount of effort.

Thank you for your attention to this matter.

Sincerely,

RequestPing FOIA Service
On behalf of a third party
${process.env.FROM_EMAIL}`;

    return body;
}

// ==================== SERVER START ====================

app.listen(PORT, () => {
    console.log(`RequestPing server running on port ${PORT}`);
});
