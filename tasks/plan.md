# Implementation Plan: Getting Started Guide

## Objective

Turn `/getting-started` from a stub into the first-call integration guide for
frontend developers. A reader should understand where authentication belongs,
make one safe `GET /v1/items` request from server-side code, and know how to
handle the API contract without putting the production key in a browser bundle.

## Source Of Truth

`docs/api-frontend-guide.md` is the API contract. `PRODUCT.md` defines the
audience, security boundary, scope, and success condition. `DESIGN.md` defines
the dark docs surface, typography, spacing, color, and component grammar.

## Architecture Decisions

- Keep the route static. The guide documents integration code; it does not call
  the API or implement a playground.
- Reuse `Root.astro` and the shared Tailwind tokens. Keep page-specific layout
  rules scoped to the guide page.
- Keep examples server-side by using `process.env.PLATINUM_GOLD_API_KEY` and
  explicitly reject `VITE_API_KEY` in browser code.
- Use native headings, lists, links, tables, and `pre`/`code` blocks. Avoid a
  component abstraction until the page has a real reuse case.

## Commands

- Lint: `pnpm lint`
- Type check: `pnpm exec tsc --noEmit`
- Build: `pnpm build`
- Dev: `pnpm dev`

## Testing Strategy

The repository has no configured test runner. Verify the static route with the
existing lint, TypeScript, and build commands, then use Chromium at 320px,
768px, 1024px, and 1440px to check wrapping, tables, focus order, code blocks,
and the absence of console errors or horizontal overflow.

## Boundaries

- Always: keep the API key out of client examples, preserve camelCase fields,
  show friendly error recovery, and keep the page keyboard navigable.
- Ask first: adding a dependency, adding a live API request, or adding an SSR
  adapter.
- Never: embed a production key, build a player catalog, generate an SDK, or
  make the guide depend on the live API.

## Task List

### Phase 1: First-call path

- [x] Add guide shell, breadcrumb, in-page navigation, and authentication
  section.
- [x] Add the server-side TypeScript request example and first response shape.

### Phase 2: Contract reference

- [x] Add endpoints, list filters, data fields, error handling, and request IDs.
- [x] Add caching, versioning, support links, and the next action.

### Checkpoint: Complete

- [x] Every in-scope contract section is findable from the page navigation.
- [x] Static build and strict type checking pass.
- [x] Desktop and mobile browser checks pass without overflow or console errors.
