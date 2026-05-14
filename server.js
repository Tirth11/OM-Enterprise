/**
 * Self Weld Industries - Authentication API
 * Node.js + Express + PostgreSQL Backend Setup
 * 
 * Installation:
 * npm install express dotenv cors bcryptjs jsonwebtoken pg
 * npm install -D nodemon
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { Pool } = require('pg');

dotenv.config();

const app = express();

// ============================================================================
// MOCK DATABASE MODE
// ============================================================================
// Use mock database if DATABASE_URL is not set
const USE_MOCK_DB = !process.env.DATABASE_URL;

let mockDB = {
  admins: [],
  otp_codes: [],
  audit_logs: []
};

// Initialize mock admin on startup
(async () => {
  if (USE_MOCK_DB) {
    const defaultAdminPassword = await bcryptjs.hash('Admin@123456', 10);
    mockDB.admins = [
      {
        id: 1,
        name: 'Self Weld Admin',
        email: 'admin@selfweldindustries.com',
        phone: '919876543210',
        password_hash: defaultAdminPassword,
        role: 'ADMIN',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
        last_login_at: null
      }
    ];
    console.log('✅ Mock database initialized with default admin');
    console.log('📧 Email: admin@selfweldindustries.com');
    console.log('🔐 Password: Admin@123456');
  }
})();

const pool = USE_MOCK_DB ? null : new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use(cors());
app.use(express.static(__dirname + '/public'));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// ============================================================================
// DATABASE SCHEMA
// ============================================================================
/*

CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'ADMIN',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login_at TIMESTAMP
);

CREATE TABLE otp_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(15) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) DEFAULT 'ADMIN_FORGOT_PASSWORD',
  expires_at TIMESTAMP NOT NULL,
  attempt_count INT DEFAULT 0,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE admin_sessions (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admins(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INT REFERENCES admins(id),
  action VARCHAR(100),
  details TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SEED DEFAULT ADMIN (one time)
INSERT INTO admins (name, email, phone, password_hash, role, is_active)
VALUES (
  'Self Weld Admin',
  'admin@selfweldindustries.com',
  '91XXXXXXXXXX',
  '$2a$10$...hashed_password_here...',
  'ADMIN',
  true
);

*/

// ============================================================================
// UTILITIES
// ============================================================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const JWT_EXPIRE = '24h';
const OTP_LENGTH = 6;
const OTP_EXPIRE_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;
const HASH_ROUNDS = 10;

// Generate OTP
function generateOTP() {
  return Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(OTP_LENGTH, '0');
}

// Hash password
async function hashPassword(password) {
  return bcryptjs.hash(password, HASH_ROUNDS);
}

// Verify password
async function verifyPassword(password, hash) {
  return bcryptjs.compare(password, hash);
}

// Generate JWT token
function generateToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, phone: admin.phone },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRE }
  );
}

// Verify JWT token
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// Auth middleware
async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  // Check if admin still exists and is active
  let admin;
  if (USE_MOCK_DB) {
    admin = mockDB.admins.find(a => a.id === payload.id);
  } else {
    const result = await pool.query(
      'SELECT * FROM admins WHERE id = $1',
      [payload.id]
    );
    admin = result.rows[0];
  }

  if (!admin || !admin.is_active) {
    return res.status(401).json({ message: 'Admin not found or inactive' });
  }

  req.admin = admin;
  next();
}

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    let adminRecord;

    if (USE_MOCK_DB) {
      // Mock DB lookup
      adminRecord = mockDB.admins.find(a => 
        (a.email === email || a.phone === email) && a.is_active
      );
    } else {
      // Real DB lookup
      const admin = await pool.query(
        'SELECT * FROM admins WHERE (email = $1 OR phone = $1) AND is_active = true',
        [email]
      );
      adminRecord = admin.rows[0];
    }

    if (!adminRecord) {
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }

    // Verify password
    const isValid = await verifyPassword(password, adminRecord.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email/phone or password' });
    }

    // Update last login
    if (USE_MOCK_DB) {
      adminRecord.last_login_at = new Date();
    } else {
      await pool.query(
        'UPDATE admins SET last_login_at = NOW() WHERE id = $1',
        [adminRecord.id]
      );
    }

    // Generate token
    const token = generateToken(adminRecord);

    // Log activity
    if (!USE_MOCK_DB) {
      await pool.query(
        'INSERT INTO audit_logs (admin_id, action, ip_address) VALUES ($1, $2, $3)',
        [adminRecord.id, 'LOGIN', req.ip]
      );
    }

    res.json({
      message: 'Login successful',
      token,
      admin: {
        id: adminRecord.id,
        name: adminRecord.name,
        email: adminRecord.email,
        phone: adminRecord.phone
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// FORGOT PASSWORD - REQUEST OTP
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length !== 12) {
      return res.status(400).json({ message: 'Invalid phone number' });
    }

    // Check if admin exists
    const admin = await pool.query(
      'SELECT id FROM admins WHERE phone = $1 AND is_active = true',
      [phone]
    );

    if (!admin.rows[0]) {
      // Don't reveal if phone exists for security
      return res.status(200).json({ message: 'If phone exists, OTP will be sent' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Save OTP
    await pool.query(
      'INSERT INTO otp_codes (phone, otp_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [phone, otpHash, 'ADMIN_FORGOT_PASSWORD', expiresAt]
    );

    // TODO: Send OTP via SMS (Twilio, AWS SNS, etc.)
    console.log(`OTP for ${phone}: ${otp}`); // Remove in production

    res.json({ message: 'OTP sent to your phone' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// VERIFY OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;

    if (!phone || !otp) {
      return res.status(400).json({ message: 'Phone and OTP required' });
    }

    // Find latest OTP
    const otpRecord = await pool.query(
      `SELECT * FROM otp_codes 
       WHERE phone = $1 AND is_used = false AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [phone]
    );

    if (!otpRecord.rows[0]) {
      return res.status(401).json({ message: 'Invalid or expired OTP' });
    }

    const record = otpRecord.rows[0];

    // Check attempts
    if (record.attempt_count >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ message: 'Too many attempts. Request new OTP.' });
    }

    // Verify OTP
    const isValid = await verifyPassword(otp, record.otp_hash);
    if (!isValid) {
      await pool.query(
        'UPDATE otp_codes SET attempt_count = attempt_count + 1 WHERE id = $1',
        [record.id]
      );
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Mark OTP as used
    await pool.query(
      'UPDATE otp_codes SET is_used = true WHERE id = $1',
      [record.id]
    );

    // Generate reset token
    const resetToken = jwt.sign(
      { phone, purpose: 'PASSWORD_RESET' },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ message: 'OTP verified', token: resetToken });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// RESEND OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone required' });
    }

    // Check if admin exists
    const admin = await pool.query(
      'SELECT id FROM admins WHERE phone = $1 AND is_active = true',
      [phone]
    );

    if (!admin.rows[0]) {
      return res.status(200).json({ message: 'If phone exists, OTP will be sent' });
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpHash = await hashPassword(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);

    // Save OTP
    await pool.query(
      'INSERT INTO otp_codes (phone, otp_hash, purpose, expires_at) VALUES ($1, $2, $3, $4)',
      [phone, otpHash, 'ADMIN_FORGOT_PASSWORD', expiresAt]
    );

    console.log(`OTP for ${phone}: ${otp}`); // Remove in production

    res.json({ message: 'OTP resent' });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, newPassword, resetToken } = req.body;

    if (!phone || !newPassword || !resetToken) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Verify reset token
    const payload = verifyToken(resetToken);
    if (!payload || payload.purpose !== 'PASSWORD_RESET' || payload.phone !== phone) {
      return res.status(401).json({ message: 'Invalid reset token' });
    }

    // Validate password
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({ message: 'Password does not meet requirements' });
    }

    // Find admin
    const admin = await pool.query(
      'SELECT id FROM admins WHERE phone = $1',
      [phone]
    );

    if (!admin.rows[0]) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Hash and update password
    const passwordHash = await hashPassword(newPassword);
    await pool.query(
      'UPDATE admins SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, admin.rows[0].id]
    );

    // Log activity
    await pool.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [admin.rows[0].id, 'PASSWORD_RESET']
    );

    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// LOGOUT
app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO audit_logs (admin_id, action) VALUES ($1, $2)',
      [req.admin.id, 'LOGOUT']
    );

    res.json({ message: 'Logout successful' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// VERIFY TOKEN
app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({
    valid: true,
    admin: {
      id: req.admin.id,
      name: req.admin.name,
      email: req.admin.email,
      phone: req.admin.phone
    }
  });
});

// ============================================================================
// PASSWORD VALIDATION
// ============================================================================

function isValidPassword(password) {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

// ============================================================================
// MODULE ROUTES (Customers, Products, Inventory, Issues)
// ============================================================================
const moduleRoutes = require('./routes-modules');
moduleRoutes.setPool(pool, USE_MOCK_DB);
app.use('/api', moduleRoutes);

// ============================================================================
// SERVER
// ============================================================================

const PORT = process.env.PORT || 5000;
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
