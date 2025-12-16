const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const { Resend } = require('resend');
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

// ==================== FOIA AGENCIES ROUTES ====================

// Get agencies from FOIA.gov API
app.get('/api/agencies', async (req, res) => {
    try {
        const apiKey = process.env.FOIA_API_KEY;
        const response = await fetch(`https://api.foia.gov/api/agency_components?api_key=${apiKey}`);
        const data = await response.json();

        // Transform and simplify agency data
        const agencies = data
            .filter(agency => agency.abbreviation && agency.name)
            .map(agency => ({
                abbreviation: agency.abbreviation,
                name: agency.name,
                description: agency.description || '',
                website: agency.website || '',
                email: agency.request_form?.email || agency.emails?.[0] || ''
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ agencies });
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

// Create new FOIA request
app.post('/api/requests', authenticateToken, async (req, res) => {
    try {
        const {
            agency,
            agency_name,
            subject,
            description,
            date_range_start,
            date_range_end,
            delivery_format,
            request_fee_waiver,
            waiver_reason
        } = req.body;

        // Validate required fields
        if (!agency || !agency_name || !subject || !description) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check user's monthly request limit
        const user = await dbGet('SELECT monthly_request_limit FROM users WHERE id = ?', [req.user.userId]);
        const requestCount = await dbGet(
            `SELECT COUNT(*) as count FROM requests
             WHERE user_id = ?
             AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
            [req.user.userId]
        );

        if (requestCount.count >= user.monthly_request_limit) {
            return res.status(403).json({ error: 'Monthly request limit reached' });
        }

        // Create request
        const requestId = generateId();
        await dbRun(
            `INSERT INTO requests (
                id, user_id, agency, agency_name, subject, description,
                date_range_start, date_range_end, delivery_format,
                request_fee_waiver, waiver_reason, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                requestId,
                req.user.userId,
                agency,
                agency_name,
                subject,
                description,
                date_range_start,
                date_range_end,
                delivery_format,
                request_fee_waiver ? 1 : 0,
                waiver_reason
            ]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (id, request_id, activity_type, description) VALUES (?, ?, ?, ?)',
            [generateId(), requestId, 'request_created', 'FOIA request created']
        );

        // Get agency email and submit request
        const apiKey = process.env.FOIA_API_KEY;
        const agencyResponse = await fetch(`https://api.foia.gov/api/agency_components?api_key=${apiKey}`);
        const agencies = await agencyResponse.json();
        const targetAgency = agencies.find(a => a.abbreviation === agency);

        if (targetAgency) {
            // Send FOIA request via email using Resend
            await submitFOIARequest(requestId, targetAgency, {
                subject,
                description,
                date_range_start,
                date_range_end,
                delivery_format,
                request_fee_waiver,
                waiver_reason
            });
        }

        res.json({ id: requestId, message: 'Request created successfully' });
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

async function submitFOIARequest(requestId, agency, requestDetails) {
    try {
        const emailBody = generateFOIAEmailBody(requestDetails);
        const agencyEmail = agency.request_form?.email || agency.emails?.[0];

        if (!agencyEmail) {
            console.error('No email found for agency:', agency.abbreviation);
            return;
        }

        // Send email via Resend
        await resend.emails.send({
            from: process.env.FROM_EMAIL,
            to: agencyEmail,
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
            [generateId(), requestId, 'request_submitted', `Request submitted to ${agency.name}`]
        );

        console.log(`FOIA request ${requestId} submitted to ${agency.name}`);
    } catch (error) {
        console.error('Error submitting FOIA request:', error);
    }
}

function generateFOIAEmailBody(details) {
    const { subject, description, date_range_start, date_range_end, delivery_format, request_fee_waiver, waiver_reason } = details;

    let body = `To Whom It May Concern:

This is a request under the Freedom of Information Act (5 U.S.C. § 552).

REQUESTED RECORDS:

${description}`;

    if (date_range_start && date_range_end) {
        body += `

DATE RANGE:
${date_range_start} to ${date_range_end}`;
    }

    body += `

DELIVERY FORMAT:
I request that the responsive records be provided in ${delivery_format === 'electronic' ? 'electronic format (PDF)' : delivery_format === 'paper' ? 'paper format' : 'either electronic or paper format'}.`;

    if (request_fee_waiver) {
        body += `

FEE WAIVER REQUEST:
I request a waiver of all fees for this request. ${waiver_reason}`;
    } else {
        body += `

FEES:
Please notify me before processing this request if the fees are expected to exceed $25.00.`;
    }

    body += `

Please acknowledge receipt of this request and provide a tracking number if available.

Thank you for your attention to this matter.

Sincerely,

RequestPing
On behalf of a third party
${process.env.FROM_EMAIL}`;

    return body;
}

// ==================== SERVER START ====================

app.listen(PORT, () => {
    console.log(`RequestPing server running on port ${PORT}`);
});
