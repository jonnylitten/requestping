// API Configuration
// Change this to your Railway backend URL when deploying to production
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3002'
    : 'https://your-railway-app.railway.app'; // Update this when you deploy to Railway

// Helper function to make API calls
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const response = await fetch(url, options);
    return response;
}
