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
    const defaultPassword = 'adarsh@123';
    const passwordHash = await bcryptjs.hash(defaultPassword, 10);

    // Check if admin already exists
    const check = await pool.query(
      'SELECT id FROM admins WHERE phone = $1',
      ['7038973721']
    );

    if (check.rows[0]) {
      // Update existing admin password
      await pool.query(
        'UPDATE admins SET password_hash = $1, name = $2, is_active = true WHERE phone = $3',
        [passwordHash, 'AUM Enterprise Admin', '7038973721']
      );
      console.log('✓ Admin password updated!');
    } else {
      await pool.query(
        `INSERT INTO admins (name, email, phone, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        ['AUM Enterprise Admin', 'aumenterprise33@gmail.com', '7038973721', passwordHash, 'ADMIN', true]
      );
      console.log('✓ Default admin created!');
    }

    console.log('\nAdmin Credentials:');
    console.log('Phone: 7038973721');
    console.log('Password: adarsh@123');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seedAdmin();
