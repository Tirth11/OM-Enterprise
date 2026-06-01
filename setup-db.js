require('dotenv').config();
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function setup() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admins(id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(100) UNIQUE NOT NULL, phone VARCHAR(15) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, role VARCHAR(50) DEFAULT 'ADMIN', is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_login_at TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS otp_codes(id SERIAL PRIMARY KEY, phone VARCHAR(15) NOT NULL, otp_hash VARCHAR(255) NOT NULL, purpose VARCHAR(50) DEFAULT 'ADMIN_FORGOT_PASSWORD', expires_at TIMESTAMP NOT NULL, attempt_count INT DEFAULT 0, is_used BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs(id SERIAL PRIMARY KEY, admin_id INT, action VARCHAR(100), details TEXT, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  console.log('Tables created');

  const hash = await bcryptjs.hash('Admin@123456', 10);
  await pool.query(`INSERT INTO admins(name,email,phone,password_hash,role,is_active) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(email) DO NOTHING`, ['Self Weld Admin','aumenterprise33@gmail.com','8275613310',hash,'ADMIN',true]);
  console.log('Admin seeded: aumenterprise33@gmail.com / Admin@123456');
  await pool.end();
}
setup().catch(e => { console.error(e.message); pool.end(); });
