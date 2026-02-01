# Authentication System

## Overview

Complete user authentication system with signup, login, logout, and session management.

## Features

### Backend

1. **User Database**
   - `users` table with id, email, password_hash, name, created_at, last_login
   - Secure password hashing with bcrypt (10 rounds)
   - Email-based authentication

2. **Auth Routes**
   - `POST /api/auth/register` - Create new account
   - `POST /api/auth/login` - Log in with email/password
   - `POST /api/auth/logout` - End session
   - `GET /api/auth/me` - Get current user

3. **Session Management**
   - Express-session with secure cookies
   - 7-day session expiry
   - HTTP-only cookies (XSS protection)
   - Secure flag in production

4. **Protected Routes**
   - `requireAuth` middleware on sensitive endpoints
   - POST /api/rooms, GET /api/rooms, POST /api/workflows, POST /api/ai/reply

5. **Socket Authentication**
   - Socket.io shares Express session
   - Unauthenticated connections rejected
   - User validated on every socket connection

### Frontend

1. **Auth Component** (`client/src/lib/Auth.svelte`)
   - Login/Signup forms with toggle
   - Email, password, name fields
   - Error handling and loading states
   - Beautiful gradient background

2. **App.svelte Integration**
   - Check auth on mount (`/api/auth/me`)
   - Redirect to login if not authenticated
   - Show loading state while checking
   - Pass user to MessagingModule

3. **MessagingModule Updates**
   - Accept `user` prop
   - Show user name and email in profile dropdown
   - "Log out" button (replaces "Close")
   - Logout redirects to home

## Setup

### 1. Environment Variables

Add to `server/.env`:

```env
SESSION_SECRET=your-secret-key-change-in-production
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### 2. Database

The `users` table is created automatically on first run.

### 3. Dependencies

Already installed:
- `bcrypt` - Password hashing
- `express-session` - Session management

## Usage

### Register New User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123","name":"John Doe"}'
```

### Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}' \
  -c cookies.txt
```

### Get Current User

```bash
curl http://localhost:3000/api/auth/me -b cookies.txt
```

### Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout -b cookies.txt
```

## Security

1. **Passwords**: Hashed with bcrypt (10 rounds), never stored in plain text
2. **Sessions**: HTTP-only cookies, secure in production
3. **CORS**: Configured with credentials support
4. **Socket.io**: Session-based auth, unauthenticated connections rejected
5. **Protected Routes**: Middleware checks session before allowing access

## Next Steps

Now that authentication is complete, you can implement:

1. **Email-based term negotiation**
   - Send term proposals to all room members via email
   - Track accept/counter responses
   - Email notifications for updates

2. **User profiles**
   - Avatar upload
   - Email verification
   - Password reset

3. **Team management**
   - Invite team members
   - Role-based permissions
   - Organization accounts

## Testing

1. Start the server: `npm start` (from root)
2. Start the client: `npm run dev` (from client/)
3. Visit http://localhost:5173
4. You'll see the login screen
5. Click "Sign up" to create an account
6. After signup, you're automatically logged in and redirected to dashboard
7. Profile dropdown shows your name, email, and "Log out"

## Troubleshooting

**"Not authenticated" on socket connection**
- Clear cookies and log in again
- Check SESSION_SECRET is set in .env

**CORS errors**
- Ensure CLIENT_URL in .env matches your frontend URL
- Check credentials: "include" in fetch calls

**Session not persisting**
- Check cookie settings (secure flag should be false in dev)
- Verify express-session middleware is before routes
