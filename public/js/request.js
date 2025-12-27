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

// Load VA record types
async function loadRecordTypes() {
    try {
        const response = await fetch('/api/va-record-types');
        const data = await response.json();

        const select = document.getElementById('record-type');
        select.innerHTML = '<option value="">Select record type...</option>';

        // Group by VA office
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
        document.getElementById('record-type').innerHTML =
            '<option value="">Error loading record types. Please refresh.</option>';
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

    const formData = {
        record_type: document.getElementById('record-type').value,
        subject: document.getElementById('subject').value,
        description: document.getElementById('description').value,
        record_author: document.getElementById('record-author').value || null,
        record_recipient: document.getElementById('record-recipient').value || null,
        record_title: document.getElementById('record-title').value || null,
        date_range_start: document.getElementById('date-range-start').value || null,
        date_range_end: document.getElementById('date-range-end').value || null,
        delivery_format: document.getElementById('delivery-format').value,
        request_fee_waiver: document.getElementById('request-fee-waiver').checked,
        waiver_reason: document.getElementById('waiver-reason').value || null,
        requester_phone: document.getElementById('requester-phone').value || null
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
            successDiv.textContent = `Request submitted to ${data.office}! Redirecting to dashboard...`;
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

// Load record types on page load
loadRecordTypes();
