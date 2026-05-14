# Self Weld Industries - Admin Dashboard

## Project Setup Guide

### 1. Frontend Setup (No build required)
- Open `index.html` in browser to see landing page
- Click "Admin Login" to access login system

### 2. Backend Setup (Node.js)

**Prerequisites:**
- Node.js 16+ installed
- PostgreSQL database
- Git

**Installation:**

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Update .env with your database URL
DATABASE_URL=postgresql://user:password@localhost:5432/self_weld_industries
JWT_SECRET=your-secret-key-here
PORT=5000
```

**Database Setup:**

```bash
# Create database
createdb self_weld_industries

# Run schema (copy SQL from server.js comments into psql)
psql -d self_weld_industries -f schema.sql

# Seed default admin
npm run seed
```

**Start Server:**

```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

Server runs on `http://localhost:5000`

---

## Auth Pages

### `/admin/login.html`
- Email/phone + password login
- Password visibility toggle
- Error handling
- Link to forgot password

### `/admin/forgot-password.html`
- Phone number entry
- OTP generation and sending
- Validates phone exists

### `/admin/verify-otp.html`
- 6-digit OTP verification
- 5-minute countdown timer
- Resend with cooldown (60 seconds)
- Max 5 attempts

### `/admin/reset-password.html`
- Password strength requirements display
- Real-time validation
- Confirm password match
- Password rules enforced

---

## API Endpoints

### POST `/api/auth/login`
Request:
```json
{ "email": "admin@...", "password": "..." }
```
Response:
```json
{ "token": "jwt_token", "admin": {...} }
```

### POST `/api/auth/forgot-password`
Request:
```json
{ "phone": "91XXXXXXXXXX" }
```

### POST `/api/auth/verify-otp`
Request:
```json
{ "phone": "91XXXXXXXXXX", "otp": "123456" }
```

### POST `/api/auth/reset-password`
Request:
```json
{ "phone": "91XXXXXXXXXX", "newPassword": "...", "resetToken": "..." }
```

### GET `/api/auth/verify`
Headers: `Authorization: Bearer <token>`
Response: Token validity check

### POST `/api/auth/logout`
Headers: `Authorization: Bearer <token>`

---

## File Structure

```
SelfWeldIndustry/
├── index.html              # Landing page
├── styles.css              # Landing page styles
├── script.js               # Landing page script
├── auth.css                # Auth pages styling
├── auth.js                 # Auth utilities
├── server.js               # Express backend
├── seed-admin.js           # Create default admin
├── package.json            # Dependencies
├── admin/
│   ├── login.html          # Login page
│   ├── forgot-password.html # Forgot password
│   ├── verify-otp.html     # OTP verification
│   └── reset-password.html  # Password reset
└── README.md               # This file
```

---

## Default Admin

**Email:** admin@selfweldindustries.com  
**Phone:** 91XXXXXXXXXX  
**Password:** Admin@123456

⚠️ Change immediately after first login!

---

## Password Requirements

✓ Minimum 8 characters  
✓ At least 1 uppercase letter (A-Z)  
✓ At least 1 lowercase letter (a-z)  
✓ At least 1 number (0-9)  
✓ At least 1 special character (!@#$%^&*)

---

## OTP Settings

- **Validity:** 5 minutes
- **Length:** 6 digits
- **Max Attempts:** 5
- **Resend Cooldown:** 60 seconds
- **Purpose:** Admin password reset

---

## Security Features

✓ Bcrypt password hashing  
✓ JWT token authentication  
✓ OTP rate limiting  
✓ Session expiry  
✓ Audit logging  
✓ CORS protection  
✓ Token refresh on expiry  
✓ Secure password requirements

---

## Next Steps (Todo)

- [ ] Add dashboard page
- [ ] Build product module
- [ ] Create customer management
- [ ] Add sales/purchase system
- [ ] Implement inventory tracking
- [ ] Add warranty/issue tracking
- [ ] Create reports module
- [ ] Build settings page
- [ ] Add SMS OTP integration
- [ ] Deploy to production

---

## Support

For issues or questions, contact the development team.
