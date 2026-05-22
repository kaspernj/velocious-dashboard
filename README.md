# Velocious Dashboard

A multi-connection dashboard for inspecting [Velocious](https://github.com/kaspernj/velocious)
background jobs — what's queued, running, completed, failed, orphaned and
scheduled. Runs on iOS, Android and the web from one Expo codebase.

It talks only to a backend's mounted background-jobs **API**, so you can point
it at any Velocious app that exposes one. The API lives in `velocious` core
(>= 1.0.382); the UI lives here.

## Backend setup

In the backend you want to monitor, mount the jobs API in the routes file:

```js
import VelociousBackgroundJobsApi from "velocious/build/src/background-jobs/web/index.js"

routes.draw((route) => {
  route.mount(VelociousBackgroundJobsApi, {
    at: "/velocious/jobs",
    accessTokens: [process.env.VELOCIOUS_JOBS_TOKEN] // the token you paste into a connection
  })
})
```

See [the Velocious dashboard docs](https://github.com/kaspernj/velocious/blob/master/docs/background-jobs-dashboard.md)
for auth options (token, authorize callback, loopback fallback) and the full
endpoint contract.

## Running the app

```bash
npm install
npm run web      # or: npm run ios / npm run android
```

Then **Add connection** with:

- **Backend URL** — e.g. `https://api.example.com` (where the backend is reachable).
- **Access token** — the bearer token configured in `accessTokens` (leave blank for a loopback-only dev backend).
- **Mount path** — the prefix you mounted at (default `/velocious/jobs`).

Connections are stored locally on the device. The app verifies the URL with a
health check before saving, then polls the overview for live counts.

## Embedded mode

When the prebuilt web bundle is served by a backend (the planned `serveUi`
mount option), that page injects `window.VELOCIOUS_DASHBOARD_CONFIG` and the app
runs against that single same-origin backend instead of showing the connection
manager.

## Status

- Read-only: overview (status counts), job lists (filter by status), job detail.
- Planned: management actions (retry / delete / kill / enqueue) once the backend
  exposes them, plus richer throughput/latency views.

## Project layout

```
app/                                  expo-router routes
  index.jsx                           connection list
  connections/new.jsx                 add a connection
  connections/[connectionId]/         per-connection screens
    index.jsx                         overview (polls /api/stats)
    jobs.jsx                          job list (filter by status)
    jobs/[jobId].jsx                  job detail
src/
  api/jobs-client.js                  REST client for the jobs API
  connections/                        persisted multi-backend connections
  components/                         Screen, FormField, StatusBadge
  config/runtime.js                   embedded vs standalone detection
```
