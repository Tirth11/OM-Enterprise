// seed-admin.js - Create default admin (run once)
const bcryptjs = require('bcryptjs');
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function seedAdmin() {
  try {
    const defaultPassword = 'Admin@123456'; // Change this!
    const passwordHash = await bcryptjs.hash(defaultPassword, 10);

    // Check if admin already exists
    const check = await pool.query(
      'SELECT id FROM admins WHERE email = $1',
      ['admin@selfweldindustries.com']
    );

    if (check.rows[0]) {
      console.log('Default admin already exists.');
      process.exit(0);
    }

    // Create admin
    const result = await pool.query(
      `INSERT INTO admins (name, email, phone, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, phone`,
      [
        'Self Weld Admin',
        'admin@selfweldindustries.com',
        '91XXXXXXXXXX', // Replace with real number
        passwordHash,
        'ADMIN',
        true
      ]
    );

    console.log('✓ Default admin created successfully!');
    console.log(`
Default Admin Credentials:
Email: admin@selfweldindustries.com
Phone: 91XXXXXXXXXX
Password: ${defaultPassword}

⚠️ IMPORTANT:
1. Change the password immediately after first login
2. Update the phone number with your actual WhatsApp number
3. Delete this seed file after creation
4. Store credentials securely
    `);

    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
