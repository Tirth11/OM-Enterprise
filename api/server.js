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

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const JWT_SECRET = process.env.JWT_SECRET || 'selfweld-secret-key-2026';

// Auth helpers
function generateToken(admin) { return jwt.sign({ id: admin.id, email: admin.email, phone: admin.phone }, JWT_SECRET, { expiresIn: '24h' }); }
function verifyToken(token) { try { return jwt.verify(token, JWT_SECRET); } catch(e) { return null; } }

// LOGIN
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  const r = await pool.query('SELECT * FROM admins WHERE (email=$1 OR phone=$1) AND is_active=true', [email]);
  if (!r.rows[0]) return res.status(401).json({ message: 'Invalid credentials' });
  const valid = await bcryptjs.compare(password, r.rows[0].password_hash);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
  const token = generateToken(r.rows[0]);
  res.json({ message: 'Login successful', token, admin: { id: r.rows[0].id, name: r.rows[0].name, email: r.rows[0].email } });
});

app.get('/api/auth/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ valid: false });
  res.json({ valid: true, admin: payload });
});

// MODULE ROUTES
const moduleRoutes = require('../routes-modules');
moduleRoutes.setPool(pool, false);
app.use('/api', moduleRoutes);

module.exports = app;
