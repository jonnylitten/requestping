# VA FOIA Implementation Guide

This guide shows how to pivot RequestPing from general federal FOIA (via FOIA.gov API) to VA-specific FOIA requests via email.

---

## 1. VA Office Configuration

Create a new file `api/va-config.js`:

```javascript
// VA FOIA Office Configuration
const VA_OFFICES = {
  VBA: {
    name: 'Veterans Benefits Administration',
    email: 'FOIA.VBACO@va.gov',
    recordTypes: [
      'benefits',
      'compensation',
      'pension',
      'education',
      'gi_bill',
      'home_loans',
      'life_insurance',
      'fiduciary',
      'vr_e', // Veteran Readiness & Employment
      'workload_statistics',
      'annual_reports'
    ],
    description: 'Claims, benefits, education, loans, insurance'
  },
  VHA: {
    name: 'Veterans Health Administration',
    email: 'vhafoiahelp@va.gov',
    phone: '(833) 880-8500',
    recordTypes: [
      'police_reports',
      'contracts',
      'budget',
      'financial_records',
      'hr_documents',
      'harassment_prevention',
      'disruptive_behavior',
      'crisis_line',
      'hospital_records' // non-personal
    ],
    description: 'Healthcare operations, contracts, HR (not personal medical records)'
  },
  NCA: {
    name: 'National Cemetery Administration',
    email: 'cemncafoia@va.gov',
    recordTypes: [
      'burial_records',
      'cemetery_history',
      'headstone_records',
      'memorial_records'
    ],
    description: 'Cemetery and burial records'
  },
  OIG: {
    name: 'Office of Inspector General',
    email: 'VAOIGFOIA-PA@va.gov',
    recordTypes: [
      'investigations',
      'audits',
      'oig_reports',
      'inspector_general'
    ],
    description: 'OIG investigations, audits, reports'
  },
  GENERAL: {
    name: 'VA General FOIA Help',
    email: 'FOIAHelp@va.gov',
    recordTypes: ['other', 'unknown', 'general'],
    description: 'General inquiries or unclear record types'
  }
};

// Function to route request to correct VA office
function getVAOffice(recordType) {
  for (const [officeCode, office] of Object.entries(VA_OFFICES)) {
    if (office.recordTypes.includes(recordType.toLowerCase())) {
      return {
        code: officeCode,
        ...office
      };
    }
  }
  // Default to general help if no match
  return {
    code: 'GENERAL',
    ...VA_OFFICES.GENERAL
  };
}

// Get all record types for frontend dropdown
function getAllRecordTypes() {
  const types = [];
  for (const office of Object.values(VA_OFFICES)) {
    for (const recordType of office.recordTypes) {
      types.push({
        value: recordType,
        label: recordType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        office: office.name
      });
    }
  }
  return types.sort((a, b) => a.label.localeCompare(b.label));
}

module.exports = {
  VA_OFFICES,
  getVAOffice,
  getAllRecordTypes
};
```

---

## 2. Database Schema Modifications

Update `database/schema.sql` to add VA-specific fields:

```sql
-- Modified FOIA Requests table for VA
CREATE TABLE IF NOT EXISTS requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,

    -- Changed from generic 'agency' to VA-specific
    va_office TEXT NOT NULL,           -- VBA, VHA, NCA, OIG, GENERAL
    va_office_name TEXT NOT NULL,      -- Full office name
    record_type TEXT NOT NULL,         -- Type of record (benefits, contracts, etc.)

    subject TEXT NOT NULL,
    description TEXT NOT NULL,

    -- VA-specific fields
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
```

Create a migration file `database/migrate-to-va.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const db = new sqlite3.Database(process.env.DB_PATH || './database/requestping.db');

// Migration to add VA-specific columns
db.serialize(() => {
    // Add new columns
    db.run(`ALTER TABLE requests ADD COLUMN record_type TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding record_type:', err);
        }
    });

    db.run(`ALTER TABLE requests ADD COLUMN record_author TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding record_author:', err);
        }
    });

    db.run(`ALTER TABLE requests ADD COLUMN record_recipient TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding record_recipient:', err);
        }
    });

    db.run(`ALTER TABLE requests ADD COLUMN record_title TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding record_title:', err);
        }
    });

    db.run(`ALTER TABLE requests ADD COLUMN requester_phone TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding requester_phone:', err);
        }
    });

    db.run(`ALTER TABLE requests ADD COLUMN requester_email TEXT`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding requester_email:', err);
        }
    });

    // Rename agency columns to va_office
    db.run(`ALTER TABLE requests RENAME COLUMN agency TO va_office`, (err) => {
        if (err && !err.message.includes('no such column')) {
            console.error('Error renaming agency:', err);
        }
    });

    db.run(`ALTER TABLE requests RENAME COLUMN agency_name TO va_office_name`, (err) => {
        if (err && !err.message.includes('no such column')) {
            console.error('Error renaming agency_name:', err);
        }
    });

    console.log('Migration completed!');
    db.close();
});
```

---

## 3. VA-Specific Email Template

Add to `api/server.js`:

```javascript
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
```

---

## 4. Updated Server Routes

Modify `api/server.js` to use VA offices instead of FOIA.gov API:

```javascript
const { getVAOffice, getAllRecordTypes } = require('./va-config');

// Replace /api/agencies with VA record types
app.get('/api/va-record-types', async (req, res) => {
    try {
        const recordTypes = getAllRecordTypes();
        res.json({ recordTypes });
    } catch (error) {
        console.error('Error fetching record types:', error);
        res.status(500).json({ error: 'Failed to fetch record types' });
    }
});

// Updated request creation endpoint
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
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Get user email for contact info
        const user = await dbGet('SELECT email, monthly_request_limit FROM users WHERE id = ?', [req.user.userId]);

        // Check monthly limit
        const requestCount = await dbGet(
            `SELECT COUNT(*) as count FROM requests
             WHERE user_id = ?
             AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`,
            [req.user.userId]
        );

        if (requestCount.count >= user.monthly_request_limit) {
            return res.status(403).json({ error: 'Monthly request limit reached' });
        }

        // Route to correct VA office
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
                record_author,
                record_recipient,
                record_title,
                date_range_start,
                date_range_end,
                delivery_format,
                request_fee_waiver ? 1 : 0,
                waiver_reason,
                requester_phone,
                user.email
            ]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (id, request_id, activity_type, description) VALUES (?, ?, ?, ?)',
            [generateId(), requestId, 'request_created', `VA FOIA request created for ${vaOffice.name}`]
        );

        // Submit request via email
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
            office: vaOffice.name
        });
    } catch (error) {
        console.error('Error creating request:', error);
        res.status(500).json({ error: 'Failed to create request' });
    }
});

// Updated submission function
async function submitVAFOIARequest(requestId, vaOffice, requestDetails) {
    try {
        const emailBody = generateVAFOIAEmailBody(requestDetails, vaOffice);

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
```

---

## 5. Frontend Updates

Update `public/js/request.js` to use VA record types:

```javascript
// Replace agency fetch with record type fetch
async function loadRecordTypes() {
    try {
        const response = await fetch('/api/va-record-types', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();

        const select = document.getElementById('record-type-select');
        select.innerHTML = '<option value="">-- Select Record Type --</option>';

        // Group by office
        const grouped = {};
        data.recordTypes.forEach(type => {
            if (!grouped[type.office]) {
                grouped[type.office] = [];
            }
            grouped[type.office].push(type);
        });

        // Create optgroups
        for (const [office, types] of Object.entries(grouped)) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = office;

            types.forEach(type => {
                const option = document.createElement('option');
                option.value = type.value;
                option.textContent = type.label;
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        }
    } catch (error) {
        console.error('Error loading record types:', error);
    }
}

// Updated form submission
async function submitRequest(formData) {
    try {
        const response = await fetch('/api/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                record_type: formData.recordType,
                subject: formData.subject,
                description: formData.description,
                record_author: formData.recordAuthor,      // Optional
                record_recipient: formData.recordRecipient, // Optional
                record_title: formData.recordTitle,         // Optional
                date_range_start: formData.dateStart,
                date_range_end: formData.dateEnd,
                delivery_format: formData.deliveryFormat,
                request_fee_waiver: formData.feeWaiver,
                waiver_reason: formData.waiverReason,
                requester_phone: formData.phone            // Optional but recommended
            })
        });

        const result = await response.json();

        if (response.ok) {
            alert(`Request submitted successfully to ${result.office}!`);
            window.location.href = '/dashboard.html';
        } else {
            alert(`Error: ${result.error}`);
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        alert('Failed to submit request');
    }
}
```

---

## 6. Environment Variables

Update `.env` to remove FOIA.gov API and keep Resend:

```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret
JWT_SECRET=your_random_secret_here

# Email Configuration (Resend) - KEEP THIS
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=requests@requestping.com

# Database
DB_PATH=./database/requestping.db

# REMOVE: FOIA_API_KEY (no longer needed)
```

---

## 7. Implementation Checklist

- [ ] Create `api/va-config.js`
- [ ] Update `database/schema.sql` with new fields
- [ ] Run `node database/migrate-to-va.js` to update existing DB
- [ ] Update email template function in `api/server.js`
- [ ] Update `/api/requests` endpoint in `api/server.js`
- [ ] Add `/api/va-record-types` endpoint
- [ ] Update frontend form to include new fields
- [ ] Update frontend JavaScript to fetch record types
- [ ] Update landing page copy to mention VA instead of "federal agencies"
- [ ] Test with each VA office email address

---

## 8. Key Changes Summary

| Component | Old (Federal FOIA) | New (VA FOIA) |
|-----------|-------------------|---------------|
| Data Source | FOIA.gov API | VA office configuration |
| Selection | Choose from 100+ agencies | Choose record type (auto-routes to office) |
| Submission | Email to varied agencies | Email to 5 VA offices |
| Fields | Generic agency fields | VA-specific (author, recipient, title) |
| Database | `agency`, `agency_name` | `va_office`, `record_type` |

---

## Testing Plan

1. **Test each record type routes correctly:**
   - Benefits request → VBA
   - Contracts → VHA
   - Burial records → NCA
   - OIG reports → OIG

2. **Verify email formatting:**
   - Includes all required CFR § 1.554 elements
   - Contact info present
   - Specific record details included

3. **Test edge cases:**
   - Unknown record type → routes to GENERAL
   - Missing optional fields → still submits
   - Fee waiver logic works

---

**Sources:**
- [38 CFR § 1.554 - Requirements for making requests](https://www.law.cornell.edu/cfr/text/38/1.554)
- [VA Freedom of Information Act](https://department.va.gov/foia/)
- [FOIA Requests - Freedom Of Information Act FOIA](https://www.va.gov/foia/Requests.asp)
