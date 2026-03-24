# Quick Start Guide

## First Time Setup

1. **Install Dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend
   cd ../frontend
   npm install
   ```

2. **Configure Environment Variables**

   **Backend** (`backend/.env`):
   ```bash
   OPENAI_API_KEY=your_openai_api_key_here
   GITHUB_TOKEN=optional
   PORT=3001
   NODE_ENV=development
   ```

   **Frontend** (`frontend/.env.local`):
   ```bash
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_ENV=development
   ```

## Running the Application

### Option 1: Two Terminals

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Option 2: Single Command (Windows)

Create` `start.bat`:
```batch
@echo off
start cmd /k "cd backend && npm run dev"
start cmd /k "cd frontend && npm run dev"
```

### Option 3: Single Command (Mac/Linux)

Create `start.sh`:
```bash
#!/bin/bash
cd backend && npm run dev &
cd frontend && npm run dev &
wait
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health

## Testing the API

Using curl:
```bash
# Health check
curl http://localhost:3001/api/health

# Analyze a repository
curl -X POST http://localhost:3001/api/repository/analyze-github \
  -H "Content-Type: application/json" \
  -d '{"githubUrl":"https://github.com/vercel/next.js"}'
```

## Common Issues

### Port Already in Use

If port 3000 or 3001 is already in use:

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### OpenAI API Key Issues

Make sure you have:
1. Created an account at https://platform.openai.com
2. Added billing information
3. Generated an API key
4. Added the key to `backend/.env`

### Module Not Found

Delete `node_modules` and reinstall:
```bash
rm -rf node_modules package-lock.json
npm install
```

## Development Workflow

1. **Make changes to code**
2. **Both servers auto-reload on save**
3. **Check browser/terminal for errors**
4. **Test your changes**

## Production Build

```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
npm start
```

## Need Help?

Check the main README.md for detailed documentation.
