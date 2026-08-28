# Implementation Plan: Live Items Example

## Objective

Add a production-ready `/items` example that demonstrates the Platinum Gold API
with server-side credential isolation, pagination, filtering, and sorting. The
page is for frontend integrators, follows the existing field-guide design, and
  must not expose `PLATINUM_BACKEND_API_KEY` to the browser.

## Architecture Decisions

- Deploy with the Astro Vercel adapter. Keep content pages prerendered and mark
  only `/api/items` as on-demand.
- Read `PLATINUM_BACKEND_API_KEY` through `astro:env/server`. The React island calls
  the same-origin proxy and cannot import or receive the credential.
- Allowlist every forwarded query parameter and enforce API bounds at the proxy.
- Use TanStack Query with the complete filter/sort/page state in the query key,
  a 15-minute stale time, and previous-page placeholder data.
- Keep controls in local React state and reset pagination when the submitted
  filters or sorting change. Do not add a router or global store.
- Match the existing dark room and aged-paper visual grammar. Skeletons reuse
  the exact result-card grid and card anatomy to avoid layout shift.

## Commands

- Tests: `pnpm test`
- Type check: `pnpm exec astro check`
- Lint: `pnpm lint`
- Build: `pnpm build`
- Dev: `pnpm dev`

## Testing Strategy

- Unit-test query parsing and allowlisting at the proxy boundary with Vitest.
- Build and lint the full Astro/React integration.
- Verify loading, success, empty, error, filtering, sorting, pagination, keyboard
  flow, console output, and responsive layouts in Chromium.

## Boundaries

- Always: keep the key server-only, validate external input, cap `limit`, return
  friendly errors, preserve request IDs for support, and use semantic controls.
- Ask first: changing the upstream API, weakening CORS, or exposing any new
  credential to browser code.
- Never: use `PUBLIC_`/`VITE_` for the API key, forward arbitrary parameters or
  headers, render upstream error codes, or log the credential.

## Task List

### Phase 1: Secure data path

- [x] Add the React, TanStack Query, Vercel, and test integrations.
- [x] Define and test the allowlisted item-list query contract.
- [x] Add the on-demand `/api/items` proxy with server-only secret access.

### Checkpoint: Data path

- [x] Contract tests pass and the project type-checks.
- [x] The built client contains no API key access.

### Phase 2: Interactive example

- [x] Build the item explorer island with filters, sorting, and pagination.
- [x] Add faithful skeletons and useful empty and error states.
- [x] Add the `/items` route and primary navigation entry using existing tokens.

### Checkpoint: Complete

- [x] Tests, type check, lint, and production build pass.
- [x] Keyboard and responsive browser checks pass without console errors.
- [x] Security and code review have no blocking findings.

## Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Secret reaches the client | Critical | Server-only env schema and same-origin proxy |
| Proxy abuse | High | Fixed upstream, allowlisted values, bounded pagination |
| Stale result flashes | Medium | Complete query keys and previous-page placeholder data |
| Loading layout shift | Medium | Skeletons share the result-card structure and grid |

## Open Questions

None.
