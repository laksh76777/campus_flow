# CampusFlow Frontend

CampusFlow uses React and Vite. From this folder, run:

```powershell
npm install
npm run dev
```

The local environment file should set:

```env
VITE_API_URL=http://localhost:8000/api/v1
```

For production builds, configure `VITE_API_URL` in the hosting provider's build environment to the actual backend origin and API base path ending in `/api/v1`. Production requests fail with an explicit configuration error if this value is missing; the frontend will not send production traffic to localhost.

Set backend `CORS_ORIGIN` to the exact frontend origin (scheme and host, no path). Do not use `*` with credentialed requests.

Available checks:

```powershell
npm run lint
npm run build
```
