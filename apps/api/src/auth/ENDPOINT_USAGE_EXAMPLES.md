# Authentication Endpoints - Usage Examples

## Overview

This document provides practical examples for using the authentication endpoints with curl, Postman, and JavaScript/TypeScript clients.

## Endpoints

### 1. Login (POST /auth/login)

#### Description
Authenticates a user with email and password. Returns an access token (15-minute expiry) and sets a refresh token in an httpOnly cookie (7-day expiry).

#### curl Example
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@taxbros.edu",
    "password": "SecurePassword123!"
  }'
```

#### Response (200 OK)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJlbWFpbCI6ImFkbWluQHRheGJyb3MuZWR1Iiwicm9sZSI6IkFETUlOSVNUUkFUT1IiLCJpYXQiOjE3MDA1MDAwMDAsImV4cCI6MTcwMDUwMDkwMH0...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "admin@taxbros.edu",
    "role": "ADMINISTRATOR",
    "mustChangePassword": false
  }
}
```

**Cookie Set:** `refreshToken` (httpOnly, secure in production, sameSite=strict, maxAge=7 days)

#### Error Responses

**401 Unauthorized - Invalid Credentials**
```json
{
  "statusCode": 401,
  "message": "Invalid email or password",
  "error": "Unauthorized"
}
```

**401 Unauthorized - Inactive Account**
```json
{
  "statusCode": 401,
  "message": "Account is not active",
  "error": "Unauthorized"
}
```

**401 Unauthorized - Account Locked**
```json
{
  "statusCode": 401,
  "message": "Account is temporarily locked. Please try again later.",
  "error": "Unauthorized"
}
```

**400 Bad Request - Validation Error**
```json
{
  "statusCode": 400,
  "message": [
    "Email must be a valid email address",
    "Password must be at least 8 characters long"
  ],
  "error": "Bad Request"
}
```

#### JavaScript/TypeScript Example
```typescript
async function login(email: string, password: string) {
  const response = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important: includes cookies
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  
  // Store access token (e.g., in memory, localStorage, or secure storage)
  localStorage.setItem('accessToken', data.accessToken);
  
  return data;
}

// Usage
try {
  const result = await login('admin@taxbros.edu', 'SecurePassword123!');
  console.log('Logged in as:', result.user.email);
  console.log('Role:', result.user.role);
} catch (error) {
  console.error('Login failed:', error.message);
}
```

---

### 2. Refresh Token (POST /auth/refresh)

#### Description
Validates the refresh token from the httpOnly cookie and returns a new access token. Implements token rotation by invalidating the old refresh token and setting a new one.

#### curl Example
```bash
curl -X POST http://localhost:3000/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

#### Response (200 OK)
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJlbWFpbCI6ImFkbWluQHRheGJyb3MuZWR1Iiwicm9sZSI6IkFETUlOSVNUUkFUT1IiLCJpYXQiOjE3MDA1MDE4MDAsImV4cCI6MTcwMDUwMjcwMH0..."
}
```

**Cookie Set:** New `refreshToken` (old token invalidated, new token issued)

#### Error Responses

**401 Unauthorized - Missing Refresh Token**
```json
{
  "statusCode": 401,
  "message": "Refresh token not found",
  "error": "Unauthorized"
}
```

**401 Unauthorized - Invalid Refresh Token**
```json
{
  "statusCode": 401,
  "message": "Invalid or expired refresh token",
  "error": "Unauthorized"
}
```

#### JavaScript/TypeScript Example
```typescript
async function refreshAccessToken() {
  const response = await fetch('http://localhost:3000/auth/refresh', {
    method: 'POST',
    credentials: 'include', // Important: sends httpOnly cookie
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  
  // Update stored access token
  localStorage.setItem('accessToken', data.accessToken);
  
  return data.accessToken;
}

// Usage
try {
  const newAccessToken = await refreshAccessToken();
  console.log('Access token refreshed');
} catch (error) {
  console.error('Token refresh failed:', error.message);
  // Redirect to login page
  window.location.href = '/login';
}
```

#### Automatic Token Refresh Pattern
```typescript
// Axios interceptor for automatic token refresh
import axios from 'axios';

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = 'Bearer ' + token;
          return axios(originalRequest);
        }).catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { accessToken } = await refreshAccessToken();
        processQueue(null, accessToken);
        originalRequest.headers['Authorization'] = 'Bearer ' + accessToken;
        return axios(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
```

---

### 3. Logout (POST /auth/logout)

#### Description
Invalidates the refresh token in the database and clears the httpOnly cookie. Requires a valid access token in the Authorization header.

#### curl Example
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -b cookies.txt \
  -c cookies.txt
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Cookie Cleared:** `refreshToken` cookie is deleted

#### Error Responses

**401 Unauthorized - Missing/Invalid Access Token**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### JavaScript/TypeScript Example
```typescript
async function logout() {
  const accessToken = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:3000/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    credentials: 'include', // Important: includes cookies
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  const data = await response.json();
  
  // Clear stored access token
  localStorage.removeItem('accessToken');
  
  return data;
}

// Usage
try {
  await logout();
  console.log('Logged out successfully');
  window.location.href = '/login';
} catch (error) {
  console.error('Logout failed:', error.message);
}
```

---

## Complete Authentication Flow Example

### React Hook Implementation

```typescript
import { createContext, useContext, useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  role: string;
  mustChangePassword: boolean;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Auto-refresh token before expiry (every 14 minutes)
  useEffect(() => {
    if (!accessToken) return;

    const interval = setInterval(async () => {
      try {
        await refreshToken();
      } catch (error) {
        console.error('Auto-refresh failed:', error);
        await logout();
      }
    }, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(interval);
  }, [accessToken]);

  const login = async (email: string, password: string) => {
    const response = await fetch('http://localhost:3000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    setAccessToken(data.accessToken);
    setUser(data.user);
  };

  const refreshToken = async () => {
    const response = await fetch('http://localhost:3000/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    setAccessToken(data.accessToken);
  };

  const logout = async () => {
    try {
      await fetch('http://localhost:3000/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Usage in Components

```typescript
function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        required
      />
      {error && <div className="error">{error}</div>}
      <button type="submit">Login</button>
    </form>
  );
}

function DashboardPage() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  return (
    <div>
      <h1>Welcome, {user?.email}</h1>
      <p>Role: {user?.role}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
```

---

## Testing with Postman

### 1. Login Request
- **Method:** POST
- **URL:** `http://localhost:3000/auth/login`
- **Headers:** `Content-Type: application/json`
- **Body (raw JSON):**
  ```json
  {
    "email": "admin@taxbros.edu",
    "password": "SecurePassword123!"
  }
  ```
- **Tests Tab (save access token):**
  ```javascript
  pm.test("Login successful", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.environment.set("accessToken", jsonData.accessToken);
  });
  ```

### 2. Refresh Request
- **Method:** POST
- **URL:** `http://localhost:3000/auth/refresh`
- **Tests Tab:**
  ```javascript
  pm.test("Token refreshed", function () {
    pm.response.to.have.status(200);
    var jsonData = pm.response.json();
    pm.environment.set("accessToken", jsonData.accessToken);
  });
  ```

### 3. Logout Request
- **Method:** POST
- **URL:** `http://localhost:3000/auth/logout`
- **Headers:** `Authorization: Bearer {{accessToken}}`
- **Tests Tab:**
  ```javascript
  pm.test("Logout successful", function () {
    pm.response.to.have.status(200);
    pm.environment.unset("accessToken");
  });
  ```

---

## Security Best Practices

### ✅ Implemented Security Features

1. **HttpOnly Cookies:** Refresh tokens stored in httpOnly cookies prevent XSS attacks
2. **Secure Flag:** Cookies use secure flag in production (HTTPS only)
3. **SameSite Strict:** Prevents CSRF attacks
4. **Token Rotation:** Old refresh tokens invalidated on each refresh
5. **Short-lived Access Tokens:** 15-minute expiry limits exposure window
6. **Password Hashing:** Bcrypt with 12 salt rounds
7. **Account Lockout:** 30-minute lockout after 5 failed attempts
8. **Database Storage:** Refresh tokens stored in database for revocation

### 🔒 Client-Side Security Recommendations

1. **Never log tokens:** Don't console.log or display tokens
2. **Clear tokens on logout:** Remove all stored authentication data
3. **Use HTTPS:** Always use HTTPS in production
4. **Validate responses:** Check response status before trusting data
5. **Handle 401 errors:** Implement automatic redirect to login
6. **Auto-refresh pattern:** Refresh tokens before expiry
7. **Secure storage:** Use secure storage mechanisms (not localStorage for sensitive data in production)

---

## Common Issues and Solutions

### Issue: "Refresh token not found"
**Cause:** Cookie not being sent with request  
**Solution:** Ensure `credentials: 'include'` is set in fetch options

### Issue: 401 on protected routes
**Cause:** Access token expired  
**Solution:** Implement automatic token refresh before requests

### Issue: CORS errors
**Cause:** Backend not configured for credentials  
**Solution:** Enable CORS with credentials:
```typescript
// In main.ts
app.enableCors({
  origin: 'http://localhost:3001', // Your frontend URL
  credentials: true,
});
```

### Issue: Cookie not set in development
**Cause:** secure flag requires HTTPS  
**Solution:** Secure flag is automatically disabled in development mode

---

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-secret-key-here-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-here-min-32-chars
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Node Environment
NODE_ENV=development  # or 'production'
```

---

## Swagger Documentation

Access the interactive API documentation at:
```
http://localhost:3000/api/docs
```

The Swagger UI provides:
- Interactive endpoint testing
- Request/response schemas
- Authentication configuration
- Example payloads
- Error response examples

**Validates Requirements:** R2 (RBAC), R36 (Authentication), R37 (Session Management)
