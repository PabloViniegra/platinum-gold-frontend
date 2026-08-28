# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Frontend developers integrating the Platinum Gold API into an app they are shipping. They open this site to complete a first successful call: authenticate with `X-API-Key`, hit one endpoint, and handle errors without leaking the production key into a public bundle.

This site is not for Isaac players browsing items, and not for teams looking for an SDK.

## Product Purpose

Platinum Gold Frontend is the human integration guide for the Platinum Gold API — a read-only REST catalog of Binding of Isaac items. The dataset is an offline Platinum God ingest; the API runtime never scrapes.

Success: the reader leaves able to make a first authenticated request, understand 401/403 and `{ error: { code, message } }` failures, and keep the key off the client.

A live `GET /v1/items` example lives at `/items`. The browser calls `/api/items`; the API key stays on the server. It is a teaching example, not a player catalog.

## Positioning

Safe frontend integration: auth, status codes, caching, and `X-Request-ID` in language a frontend developer can act on. Swagger at `/docs` and Platinum God cannot truthfully claim that job.

## Operating Context

- Contract: `docs/api-frontend-guide.md` (local, gitignored). OpenAPI at `/openapi.json`; Swagger at `/docs`.
- Current base URL: `https://platinum-gold-backend.vercel.app/` — data routes under `/v1`. Production URL may come from a backend contact.
- Every `/v1/...` call sends `X-API-Key`. Missing or invalid → 401; key lacks `api:access` → 403.
- Keys are Clerk-issued. This site does not issue keys.
- Local app: `pnpm dev` at `localhost:4321`.

## Capabilities and Constraints

- In scope now: a human guide covering authentication, endpoints (`GET /health`, `GET /health/ready`, `GET /v1/items`, `GET /v1/items/{gameId}`, `GET /v1/items/random`, `GET /v1/meta`), query params, errors, client caching, and a live item-list example at `/items`.
- Out of scope: player-facing catalog UI; SDK or generated client; scraping Platinum God; embedding the production key in a public bundle (including `VITE_API_KEY` in the browser).
- Live example: `/items` calls `/api/items` through the Vercel adapter. `PLATINUM_BACKEND_API_KEY` is server-only. The guide still stands alone if the example is unconfigured.
- Errors: show a friendly message, never the raw `code`. Forward `X-Request-ID` to logs and support.
- Wire: camelCase JSON. Unknown fields are opaque. `/v1` stays until an announced `/v2`.
- Client cache: list 15 min by full query string; item-by-id 24 h; meta 24 h; random only if reused; never cache `/health/*`.
- Terminology: Item (`ItemResponse`), `gameId`, quality `0`–`4`, type `active` | `passive` | `familiar`, `rechargeTime`, `introducedInVersion`, `datasetVersion`, meta, `api:access`.
- Undecided: how readers obtain an API key; production deploy target.

## Brand Commitments

Product name: Platinum Gold. Do not rename it or present this site as Platinum God.

## Evidence on Hand

- `docs/api-frontend-guide.md` — integration contract.
- Live API at `https://platinum-gold-backend.vercel.app/` with `/openapi.json` and `/docs`.
- No testimonials, case studies, or shipped-client screenshots. Do not fabricate them.

## Product Principles

1. Optimize for a first successful call, not an exhaustive encyclopedia.
2. The production API key never ships to the browser.
3. Teach the contract; do not become a player catalog or an SDK.
4. The guide must stand alone. The live example cannot block the docs.
