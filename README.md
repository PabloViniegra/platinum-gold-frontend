# Platinum Gold frontend

Documentation for frontend developers integrating the Platinum Gold API. The site explains authentication, endpoints, errors, caching, and safe API-key handling. `/items` includes a live server-proxied request example.

## Local development

Requires Node.js 22.12 or newer and pnpm.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

The development server runs at `http://localhost:4321`.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start the Astro development server |
| `pnpm test` | Run the Vitest suite |
| `pnpm exec astro check` | Check Astro and TypeScript |
| `pnpm lint` | Run Oxlint and the local anti-slop plugin |
| `pnpm build` | Build the Vercel deployment |
| `pnpm preview` | Preview the production build |

## Server configuration

`PLATINUM_BACKEND_API_KEY` enables the `/items` example. The API-key request queue also needs Turso, Resend, and administrator session variables declared in `astro.config.mjs`.

All credentials are server-only. Never prefix them with `PUBLIC_` or `VITE_`.

The public request form stores pending applications in Turso. Administrators use the unlinked environment-configured route to approve or deny requests. Approval emails a manually supplied key without storing it.

## Deployment

The project uses the Astro Vercel adapter. Configure the server variables for Preview and Production before deployment.

Add a Vercel Firewall rate-limit rule for `/api/items`, keyed by IP. Start in log mode, observe normal traffic, then enable blocking with a `429` response.
