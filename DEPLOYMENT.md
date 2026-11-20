# HandyHire Deployment

## Important: keep the frontend and backend URLs aligned

The checked-in root `api-config.json` currently points to a Render backend URL. The Railway instructions below describe a Railway deployment. These are separate hosting choices: after deploying or moving the backend, update `api-config.json` so the frontend points to the backend that is actually running.

Do not assume that changing the deployment instructions changes the live API URL. Verify the backend health endpoint after deployment and then update the frontend configuration.

## Backend: Railway

Deploy the `backend` directory as the FastAPI service.

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Required environment variables:

```text
APP_ENV=production
DATABASE_URL=<Neon PostgreSQL connection string>
SECRET_KEY=<strong random secret>
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=https://<your-vercel-domain>
```

### Persistent uploads

HandyHire currently stores all uploaded files under `backend/uploads`:

- profile images: `backend/uploads/profile-images`
- provider work photos: `backend/uploads/worker-work-photos`
- booking photos: `backend/uploads/booking-photos`

Attach one Railway Volume to the backend service and set its mount path to:

```text
/app/backend/uploads
```

This intentionally matches the application's existing upload directory so profile, work and booking photos survive Railway restarts/redeployments without changing their public `/static/...` URLs.

Do not mount the volume somewhere else unless the backend upload paths are changed at the same time.

## Frontend: Vercel

Deploy the repository's static frontend normally.

After Railway generates the public backend URL, edit only the root `api-config.json` file:

```json
{
  "apiBaseUrl": "https://YOUR-BACKEND.up.railway.app"
}
```

Do not include a trailing slash.

`js/api.js` loads this file at runtime, so individual HTML pages do not need their own backend URL and legacy localhost requests are rewritten to the deployed API.

Finally, set Railway `CORS_ORIGINS` to the exact Vercel origin, for example:

```text
CORS_ORIGINS=https://handyhiree.vercel.app
```

If both a production and preview/custom domain should work, provide a comma-separated list.

## Before a release

- Confirm the deployed backend URL responds at `/api/health`.
- Confirm `api-config.json` uses that same backend URL.
- Confirm `CORS_ORIGINS` includes the deployed frontend origin.
- Confirm the production database and persistent upload storage are configured.
- Never commit production `.env` files, credentials or database connection strings.
