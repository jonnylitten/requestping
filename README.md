# RequestPing

Privacy-first VA FOIA request filing service. File Department of Veterans Affairs FOIA requests anonymously with transparent pricing.

## Overview

RequestPing is a web application that allows users to file Freedom of Information Act (FOIA) requests to the Department of Veterans Affairs while maintaining their privacy. We file requests in RequestPing's name, keeping the requester's identity completely private.

## Features

- **Anonymous Filing**: Requests filed in RequestPing's name, not yours
- **VA Office Routing**: Automatically routes to correct VA office (VBA, VHA, NCA, OIG)
- **Request Tracking**: Private dashboard to monitor all your requests
- **Email-Based Submission**: Direct submission to VA FOIA offices via email
- **Document Delivery**: Secure delivery of received documents
- **Transparent Pricing**: $20/month for up to 5 requests

## Tech Stack

**Frontend:**
- HTML/CSS/JavaScript
- Vanilla JS (no framework dependencies)
- Responsive design

**Backend:**
- Node.js + Express
- SQLite database
- JWT authentication
- Resend for email delivery

**APIs:**
- Resend API for email sending to VA offices

## Project Structure

```
requestping/
├── public/              # Frontend files
│   ├── index.html       # Landing page
│   ├── signup.html      # User registration
│   ├── login.html       # User login
│   ├── request.html     # New request form
│   ├── dashboard.html   # User dashboard
│   ├── css/
│   │   └── style.css    # All styles
│   └── js/
│       ├── signup.js
│       ├── login.js
│       ├── request.js
│       └── dashboard.js
├── api/
│   └── server.js        # Express API server
├── database/
│   ├── schema.sql       # Database schema
│   └── init.js          # Database initialization
├── .env                 # Environment variables
├── .gitignore
└── package.json
```

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd requestping
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Copy `.env` and fill in your values:
   ```bash
   # Server Configuration
   PORT=3000
   NODE_ENV=development

   # JWT Secret (change to a random string)
   JWT_SECRET=your_random_secret_here

   # Email Configuration (Resend)
   RESEND_API_KEY=your_resend_api_key
   FROM_EMAIL=requests@requestping.com

   # Database
   DB_PATH=./database/requestping.db
   ```

4. **Initialize the database**
   ```bash
   node database/init.js
   ```

5. **Start the server**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

6. **Access the application**

   Open http://localhost:3000 in your browser

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create new user account
- `POST /api/auth/login` - Login and receive JWT token

### VA Record Types
- `GET /api/va-record-types` - Get list of VA record types and offices

### Requests
- `GET /api/requests` - Get all requests for authenticated user
- `POST /api/requests` - Create new VA FOIA request
- `GET /api/requests/:id` - Get specific request details

## Deployment

### Backend (Railway)

1. Create new project on Railway
2. Connect GitHub repository
3. Add environment variables in Railway dashboard
4. Deploy automatically on push to main branch

### Frontend (GitHub Pages)

1. Push `public/` directory to GitHub
2. Enable GitHub Pages in repository settings
3. Update API calls in JS files to point to Railway backend URL

Example API URL update:
```javascript
// Change from:
fetch('/api/requests')

// To:
fetch('https://your-railway-app.railway.app/api/requests')
```

## Legal Considerations

RequestPing operates as a legal proxy service under federal FOIA law:

- Federal FOIA allows "any person" to file requests
- Supreme Court precedent confirms requester identity is irrelevant
- We file in RequestPing's corporate name
- Commercial fee rates apply by default
- We do NOT provide legal advice or appeal assistance

**Important:** RequestPing is not a law firm and does not provide legal representation.

## Privacy & Data Minimization

- We collect minimal user data (email + password only)
- Requests filed in our name, not yours
- No request data is publicly posted
- Documents delivered securely to your account
- Database uses encryption for sensitive fields

## Fee Structure

Since we file requests in RequestPing's name, commercial fee category applies by default. Users may be responsible for:

- Search fees
- Duplication fees
- Review fees (rare)

We notify users before processing if significant fees are expected.

## VA Office Coverage

RequestPing routes requests to the appropriate VA office:

- **VBA (Veterans Benefits Administration)**: Benefits, compensation, education, home loans, insurance
- **VHA (Veterans Health Administration)**: Healthcare operations, contracts, HR documents
- **NCA (National Cemetery Administration)**: Cemetery and burial records
- **OIG (Office of Inspector General)**: OIG investigations, audits, reports

## Limitations

**Current MVP covers:**
- Department of Veterans Affairs FOIA requests only
- Basic request filing and tracking
- Email submission to VA offices
- Automatic routing to correct VA office

**Not included in MVP:**
- Other federal agency requests
- State-level FOIA requests
- Appeals assistance (would require licensed attorney)
- Advanced fee waiver arguments
- Litigation support

## Contributing

This is a private project. For questions or issues, contact support@requestping.com

## License

MIT License - see LICENSE file for details

## Contact

- Website: https://requestping.com
- Email: hello@requestping.com
- Support: support@requestping.com

---

**Disclaimer:** RequestPing is not a law firm. We do not provide legal advice. This service helps you file FOIA requests but does not constitute legal representation. For complex requests or appeals, consult a FOIA attorney.
