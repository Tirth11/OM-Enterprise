const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');
const { Pool } = require('pg');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Clean DATABASE_URL (remove any whitespace/newlines that may have been introduced during env var paste)
const dbUrl = (process.env.DATABASE_URL || '').replace(/\s+/g, '').replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({ 
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

const JWT_SECRET = process.env.JWT_SECRET || 'selfweld-secret-key-2026';
const OTP_EXPIRE_MINUTES = 5;
const MAX_OTP_ATTEMPTS = 5;

function generateToken(admin) { return jwt.sign({ id: admin.id, email: admin.email, phone: admin.phone }, JWT_SECRET, { expiresIn: '24h' }); }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET); } catch(e) { return null; } }
function generateOTP() { return Math.floor(Math.random() * 1000000).toString().padStart(6, '0'); }

async function sendOTP(phone, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) { console.log('OTP (no SMS key):', otp); return false; }
  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: { 'authorization': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ route: 'otp', variables_values: otp, numbers: phone, flash: 0 })
    });
    const data = await res.json();
    return !!data.return;
  } catch(e) { return false; }
}

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email/phone and password required' });
    const r = await pool.query('SELECT * FROM admins WHERE (email=$1 OR phone=$1) AND is_active=true', [email]);
    if (!r.rows[0]) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcryptjs.compare(password, r.rows[0].password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    await pool.query('UPDATE admins SET last_login_at=NOW() WHERE id=$1', [r.rows[0].id]);
    res.json({ message: 'Login successful', token: generateToken(r.rows[0]), admin: { id: r.rows[0].id, name: r.rows[0].name, email: r.rows[0].email, phone: r.rows[0].phone } });
  } catch(e) { console.error('Login error:', e.message); res.status(500).json({ message: 'Server error' }); }
});

// VERIFY TOKEN
app.get('/api/auth/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ valid: false });
  res.json({ valid: true, admin: payload });
});

// FORGOT PASSWORD
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone || phone.length < 10) return res.status(400).json({ message: 'Invalid phone number' });
    const admin = await pool.query('SELECT id FROM admins WHERE phone=$1 AND is_active=true', [phone]);
    if (!admin.rows[0]) return res.json({ message: 'If phone exists, OTP will be sent' });
    const otp = generateOTP();
    const otpHash = await bcryptjs.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000);
    await pool.query('INSERT INTO otp_codes(phone,otp_hash,purpose,expires_at) VALUES($1,$2,$3,$4)', [phone, otpHash, 'ADMIN_FORGOT_PASSWORD', expiresAt]);
    await sendOTP(phone, otp);
    console.log(`OTP for ${phone}: ${otp}`);
    res.json({ message: 'OTP sent to your phone' });
  } catch(e) { res.status(500).json({ message: 'Server error' }); }
});

// VERIFY OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'Phone and OTP required' });
    const r = await pool.query('SELECT * FROM otp_codes WHERE phone=$1 AND is_used=false AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1', [phone]);
    if (!r.rows[0]) return res.status(401).json({ message: 'Invalid or expired OTP' });
    if (r.rows[0].attempt_count >= MAX_OTP_ATTEMPTS) return res.status(429).json({ message: 'Too many attempts' });
    const valid = await bcryptjs.compare(otp, r.rows[0].otp_hash);
    if (!valid) { await pool.query('UPDATE otp_codes SET attempt_count=attempt_count+1 WHERE id=$1', [r.rows[0].id]); return res.status(401).json({ message: 'Invalid OTP' }); }
    await pool.query('UPDATE otp_codes SET is_used=true WHERE id=$1', [r.rows[0].id]);
    res.json({ message: 'OTP verified', token: jwt.sign({ phone, purpose: 'PASSWORD_RESET' }, JWT_SECRET, { expiresIn: '15m' }) });
  } catch(e) { res.status(500).json({ message: 'Server error' }); }
});

// RESEND OTP
app.post('/api/auth/resend-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone required' });
    const otp = generateOTP();
    const otpHash = await bcryptjs.hash(otp, 10);
    await pool.query('INSERT INTO otp_codes(phone,otp_hash,purpose,expires_at) VALUES($1,$2,$3,$4)', [phone, otpHash, 'ADMIN_FORGOT_PASSWORD', new Date(Date.now() + OTP_EXPIRE_MINUTES*60*1000)]);
    await sendOTP(phone, otp);
    console.log(`OTP for ${phone}: ${otp}`);
    res.json({ message: 'OTP resent' });
  } catch(e) { res.status(500).json({ message: 'Server error' }); }
});

// RESET PASSWORD
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { phone, newPassword, resetToken } = req.body;
    if (!phone || !newPassword || !resetToken) return res.status(400).json({ message: 'Missing fields' });
    const payload = verifyToken(resetToken);
    if (!payload || payload.purpose !== 'PASSWORD_RESET' || payload.phone !== phone) return res.status(401).json({ message: 'Invalid reset token' });
    const hash = await bcryptjs.hash(newPassword, 10);
    await pool.query('UPDATE admins SET password_hash=$1, updated_at=NOW() WHERE phone=$2', [hash, phone]);
    res.json({ message: 'Password reset successful' });
  } catch(e) { res.status(500).json({ message: 'Server error' }); }
});

// HEALTH CHECK
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Public route for landing page phone
app.get('/api/admin-phone', async (req, res) => {
  // Always return the business contact number
  res.json({ phone: '8275613310' });
});

// MODULE ROUTES
const path = require('path');
const moduleRoutes = require(path.join(__dirname, '..', 'routes-modules'));
moduleRoutes.setPool(pool, false);
app.use('/api', moduleRoutes);

module.exports = app;
