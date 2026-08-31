# Platinum Gold frontend

![Astro](https://img.shields.io/badge/Astro-BC52EE?logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white)
![pnpm](https://img.shields.io/badge/pnpm-F69220?logo=pnpm&logoColor=white)
![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-3DA639?logo=open-source-initiative&logoColor=white)

Documentation site for frontend developers integrating the [Platinum Gold API](https://tboi-api.pabloviniegra.dev/). The site explains authentication, endpoints, errors, caching, and safe API-key handling. `/items` includes a live server-proxied request example.

## Table of contents

- [Stack](#stack)
- [Getting started](#getting-started)
- [Commands](#commands)
- [Project structure](#project-structure)
- [API](#api)
- [Server configuration](#server-configuration)
- [Deployment](#deployment)
- [License](#license)

## Stack

- **[Astro](https://astro.build)** with server output (Vercel adapter)
- **[React 19](https://react.dev)** for interactive islands
- **[TypeScript](https://www.typescriptlang.org)** (strict)
- **[Tailwind CSS 4](https://tailwindcss.com)** via `@tailwindcss/vite`
- **[Oxlint](https://oxc.rs)** with a local anti-slop plugin
- **[Vitest](https://vitest.dev)** for tests
- **[pnpm](https://pnpm.io)** as package manager, Node.js >= 22.12

## Getting started

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

## Project structure

```
src/
├── assets/       # Static assets
├── components/   # Astro and React components
├── emails/       # React Email templates
├── layouts/      # Page layouts
├── lib/          # Server-side logic (API clients, key requests)
├── pages/
│   ├── api/      # Server endpoints (items proxy, admin, key requests)
│   └── *.astro   # Documentation pages (/ , /items , /getting-started)
├── scripts/      # Browser scripts
└── styles/       # Global styles
```

## API

Base URL: `https://tboi-api.pabloviniegra.dev/`

- Interactive reference: [`/docs`](https://tboi-api.pabloviniegra.dev/docs) (Swagger UI)
- OpenAPI schema: [`/openapi.json`](https://tboi-api.pabloviniegra.dev/openapi.json)

The API is a read-only REST catalog of Binding of Isaac items. Every `/v1/...` call requires an `X-API-Key` header with the `api:access` scope; missing or invalid keys return `401`, keys without the scope return `403`.

| Endpoint | Description |
| --- | --- |
| `GET /v1/items` | List items with filters and pagination |
| `GET /v1/items/{gameId}` | Single item by `gameId` |
| `GET /v1/items/random` | Random item, same filters |
| `GET /v1/meta` | Dataset metadata |

All playground traffic is proxied server-side; the API key never ships to the client.

## Server configuration

`PLATINUM_BACKEND_API_KEY` enables the `/items` example. The API-key request queue also needs Turso, Resend, `RESEND_WEBHOOK_SECRET`, and administrator session variables declared in `astro.config.mjs`.

All credentials are server-only. Never prefix them with `PUBLIC_` or `VITE_`.

The public request form stores pending applications in Turso. Administrators use the unlinked environment-configured route to approve or deny requests. Approval emails a manually supplied key without storing it.

## Deployment

The project uses the Astro Vercel adapter. Configure the server variables for Preview and Production before deployment.

Add a Vercel Firewall rate-limit rule for `/api/items`, keyed by IP. Start in log mode, observe normal traffic, then enable blocking with a `429` response.

## License

Distributed under the [MIT License](LICENSE).
