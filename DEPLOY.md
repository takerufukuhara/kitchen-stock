# Deploy

This project has two deployable apps:

- `backend`: Express API, deployed as a Node/Docker web service
- `frontend`: Vite React app, deployed as a static site

## Required Environment Variables

Backend:

```text
PORT=3001
CORS_ORIGIN=https://your-frontend-domain.example
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Frontend:

```text
VITE_API_URL=https://your-backend-domain.example
```

## Important Secret Handling

Do not commit `.env` files. This repo now ignores `.env` and `.env.*`, but if
`backend/.env` or `frontend/.env` were already committed, remove them from git
tracking before pushing:

```sh
git rm --cached backend/.env frontend/.env
```

If a real Supabase service role key was already pushed to GitHub, rotate it in
Supabase before using the production deployment.

## Backend

The backend now supports production build and start commands:

```sh
cd backend
npm ci
npm run build
npm start
```

For Docker-based hosts, use `backend/Dockerfile`.

Recommended service settings:

- Root directory: `backend`
- Build method: Dockerfile
- Health check path: `/health`
- Port: use the provider's `PORT` environment variable when available

## Frontend

The frontend builds with:

```sh
cd frontend
npm ci
npm run build
```

The static output is `frontend/dist`.

For Vercel from the repository root, `vercel.json` is included. Set
`VITE_API_URL` in Vercel after the backend has a public URL.

## Deployment Order

1. Deploy the backend first.
2. Copy the backend public URL.
3. Set `VITE_API_URL` on the frontend host.
4. Deploy the frontend.
5. Set `CORS_ORIGIN` on the backend to the frontend public URL.
6. Redeploy or restart the backend.
