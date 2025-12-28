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

// Load agencies from FOIA.gov API
async function loadAgencies() {
    try {
        const response = await fetch('/api/agencies');
        const data = await response.json();

        const select = document.getElementById('agency');
        select.innerHTML = '<option value="">Select an agency...</option>';

        data.agencies.forEach(agency => {
            const option = document.createElement('option');
            option.value = agency.abbreviation;
            option.textContent = `${agency.name} (${agency.abbreviation})`;
            option.dataset.name = agency.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading agencies:', error);
        document.getElementById('agency').innerHTML =
            '<option value="">Error loading agencies. Please refresh.</option>';
    }
}

// Toggle fee waiver justification field
document.getElementById('request-fee-waiver').addEventListener('change', (e) => {
    const justificationDiv = document.getElementById('fee-waiver-justification');
    const justificationField = document.getElementById('waiver-reason');

    if (e.target.checked) {
        justificationDiv.style.display = 'block';
        justificationField.required = true;
    } else {
        justificationDiv.style.display = 'none';
        justificationField.required = false;
        justificationField.value = '';
    }
});

// Handle form submission
document.getElementById('request-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const agencySelect = document.getElementById('agency');
    const formData = {
        agency: agencySelect.value,
        agency_name: agencySelect.options[agencySelect.selectedIndex].dataset.name,
        subject: document.getElementById('subject').value,
        description: document.getElementById('description').value,
        date_range_start: document.getElementById('date-range-start').value || null,
        date_range_end: document.getElementById('date-range-end').value || null,
        delivery_format: document.getElementById('delivery-format').value,
        request_fee_waiver: document.getElementById('request-fee-waiver').checked,
        waiver_reason: document.getElementById('waiver-reason').value || null
    };

    const errorDiv = document.getElementById('error-message');
    const successDiv = document.getElementById('success-message');

    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    try {
        const response = await fetch('/api/requests', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (response.ok) {
            successDiv.textContent = 'Request created successfully! Redirecting to dashboard...';
            successDiv.style.display = 'block';

            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 2000);
        } else {
            errorDiv.textContent = data.error || 'Failed to create request';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.style.display = 'block';
    }
});

// Load agencies on page load
loadAgencies();
