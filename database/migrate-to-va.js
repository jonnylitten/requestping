const sqlite3 = require('sqlite3').verbose();
require('dotenv').config();

const db = new sqlite3.Database(process.env.DB_PATH || './database/requestping.db');

console.log('Starting migration to VA-specific schema...');

// Migration to add VA-specific columns
db.serialize(() => {
    // Add new columns
    const newColumns = [
        { name: 'record_type', type: 'TEXT' },
        { name: 'record_author', type: 'TEXT' },
        { name: 'record_recipient', type: 'TEXT' },
        { name: 'record_title', type: 'TEXT' },
        { name: 'requester_phone', type: 'TEXT' },
        { name: 'requester_email', type: 'TEXT' },
        { name: 'va_office', type: 'TEXT' },
        { name: 'va_office_name', type: 'TEXT' }
    ];

    newColumns.forEach(col => {
        db.run(`ALTER TABLE requests ADD COLUMN ${col.name} ${col.type}`, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log(`Column ${col.name} already exists, skipping...`);
                } else {
                    console.error(`Error adding ${col.name}:`, err.message);
                }
            } else {
                console.log(`Added column: ${col.name}`);
            }
        });
    });

    // Copy data from old columns to new ones
    setTimeout(() => {
        db.run(`UPDATE requests SET va_office = agency WHERE va_office IS NULL`, (err) => {
            if (err) {
                console.error('Error copying agency to va_office:', err.message);
            } else {
                console.log('Copied agency → va_office');
            }
        });

        db.run(`UPDATE requests SET va_office_name = agency_name WHERE va_office_name IS NULL`, (err) => {
            if (err) {
                console.error('Error copying agency_name to va_office_name:', err.message);
            } else {
                console.log('Copied agency_name → va_office_name');
            }
        });

        setTimeout(() => {
            console.log('\nMigration complete!');
            console.log('Note: The old "agency" and "agency_name" columns still exist for backwards compatibility.');
            console.log('You can manually remove them later if desired.');
            db.close();
        }, 500);
    }, 1000);
});
