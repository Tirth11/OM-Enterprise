// Authentication utilities
const API_BASE = '/api';

// Token management
const TokenManager = {
  set(token) {
    localStorage.setItem('adminToken', token);
  },
  get() {
    return localStorage.getItem('adminToken');
  },
  clear() {
    localStorage.removeItem('adminToken');
  },
  isValid() {
    const token = this.get();
    return !!token && !this.isExpired(token);
  },
  isExpired(token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }
};

// API caller with auth
async function apiCall(endpoint, options = {}) {
  const token = TokenManager.get();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    TokenManager.clear();
    window.location.href = '/admin/login.html';
    return null;
  }

  return response;
}

// Protected page guard
function requireAuth() {
  if (!TokenManager.isValid()) {
    window.location.href = '/admin/login.html';
  }
}

// Auto logout on token expiry
function setupAutoLogout() {
  const token = TokenManager.get();
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresIn = (payload.exp * 1000) - Date.now();

    if (expiresIn > 0) {
      setTimeout(() => {
        TokenManager.clear();
        alert('Your session has expired. Please login again.');
        window.location.href = '/admin/login.html';
      }, expiresIn);
    }
  } catch (err) {
    console.error('Error parsing token:', err);
  }
}

// Logout function
function logout() {
  TokenManager.clear();
  window.location.href = '/admin/login.html';
}
