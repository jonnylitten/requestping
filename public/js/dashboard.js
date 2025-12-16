// Check authentication
const token = localStorage.getItem('token');
if (!token) {
    window.location.href = 'login.html';
}

// Logout functionality
document.getElementById('logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('token');
    window.location.href = 'index.html';
});

// Load user's requests
async function loadRequests() {
    try {
        const response = await fetch('/api/requests', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
            return;
        }

        const data = await response.json();

        // Update usage info
        const usedCount = data.requests.length;
        const maxCount = 5; // From Standard plan
        document.getElementById('requests-used').textContent =
            `${usedCount} of ${maxCount} requests used this month`;

        // Display requests
        const container = document.getElementById('requests-container');
        const noRequests = document.getElementById('no-requests');

        if (data.requests.length === 0) {
            container.style.display = 'none';
            noRequests.style.display = 'block';
        } else {
            container.innerHTML = data.requests.map(req => createRequestCard(req)).join('');
            container.style.display = 'block';
            noRequests.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading requests:', error);
        document.getElementById('requests-container').innerHTML =
            '<p style="text-align: center; color: var(--danger-color);">Failed to load requests. Please try again.</p>';
    }
}

function createRequestCard(request) {
    const statusClass = `status-${request.status}`;
    const statusText = request.status.charAt(0).toUpperCase() + request.status.slice(1);
    const createdDate = new Date(request.created_at).toLocaleDateString();

    return `
        <div class="request-card">
            <div class="request-header">
                <div>
                    <h3>${request.subject}</h3>
                    <p style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${request.agency_name}
                    </p>
                </div>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </div>
            <p style="color: var(--text-secondary); margin-bottom: 0.5rem;">
                ${truncateText(request.description, 150)}
            </p>
            <div class="request-meta">
                <span>Filed: ${createdDate}</span>
                ${request.submitted_at ? `<span> • Submitted: ${new Date(request.submitted_at).toLocaleDateString()}</span>` : ''}
                ${request.tracking_number ? `<span> • Tracking: ${request.tracking_number}</span>` : ''}
            </div>
            ${request.status === 'completed' && request.documents_count > 0 ? `
                <div style="margin-top: 1rem;">
                    <a href="/api/requests/${request.id}/documents" class="primary-button" style="text-decoration: none; font-size: 0.9rem; padding: 0.5rem 1rem;">
                        View Documents (${request.documents_count})
                    </a>
                </div>
            ` : ''}
        </div>
    `;
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Load requests on page load
loadRequests();
