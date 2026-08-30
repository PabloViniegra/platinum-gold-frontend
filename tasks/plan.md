# Implementation Plan: API Key Request Queue

## Overview

Implement the approved contract in `docs/api-key-requests-spec.md` as three vertical slices: public request intake, protected administration, and manual approval delivery. The existing Astro/Vercel architecture remains in place; only routes that access Turso, Resend, or admin secrets render on demand.

## Architecture Decisions

- Keep public content prerendered and use same-origin Astro API routes for all secret-bearing work.
- Use `@libsql/client` directly. Initialize the small schema idempotently at the repository boundary instead of adding an ORM or migration framework.
- Use React Hook Form only where interactive form state benefits from it. Do not add a toast, modal, auth, or state-management library.
- Return the specified `409` response for duplicate normalized emails and do not duplicate mail.
- Send applicant and administrator intake emails with separate Resend idempotency keys and persist their message IDs.
- Keep issued API keys ephemeral: approval reserves the decision, sends with a stable idempotency key, records only the Resend message ID, then transitions the request to approved.
- Store a scrypt admin password hash in the environment and use a short-lived HMAC-signed `HttpOnly` cookie. The environment-configured admin path is defense in depth, not authorization.
- Enforce public and login throttles through Turso using hashed identifiers so rate limits work across Vercel instances without storing raw IP addresses.

## Dependency Graph

```text
Dependencies and environment contract
  -> input/session contracts
    -> Turso repository and rate limits
      -> React Email delivery
        -> public request endpoint
          -> public dialog and toast
    -> admin session endpoint and guarded route
      -> pending queue endpoint
        -> approval endpoint and admin panel
          -> browser/security verification
```

## Task 1: Establish Server Dependencies And Environment

**Description:** Add the minimum runtime packages and type-safe server environment declarations required by the approved design. Document placeholders for every new secret and provide a standard-library password-hash command.

**Acceptance criteria:**
- [ ] `@libsql/client`, `resend`, `react-email`, and `react-hook-form` are installed with the pnpm lockfile updated.
- [ ] Every required variable is server-only in Astro's environment schema and represented without a real value in `.env.example`.
- [ ] A documented command generates a valid scrypt password hash without exposing the password in repository files.

**Verification:**
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm exec astro check`
- [ ] `pnpm lint`

**Dependencies:** None

**Files likely touched:**
- `package.json`
- `pnpm-lock.yaml`
- `astro.config.mjs`
- `.env.example`
- `scripts/hash-admin-password.mjs`

**Estimated scope:** Medium

## Task 2: Define And Test Boundary Contracts

**Description:** Write tests first for public input normalization, use-case validation, safe response errors, session expiry/signatures, and password verification; then implement narrow TypeScript modules using Node crypto and Web-standard APIs.

**Acceptance criteria:**
- [ ] Public input is trimmed, bounded, normalized, and rejects unknown keys/use cases or invalid conditional details.
- [ ] Session tokens reject tampering and expiry; password verification uses scrypt and constant-time comparison.
- [ ] Tests cover valid, invalid, oversized, expired, and tampered cases without broad aliases or assertions.

**Verification:**
- [ ] `pnpm test -- src/lib/api-key-requests/contracts.test.ts src/lib/api-key-requests/auth.test.ts`
- [ ] `pnpm exec astro check`

**Dependencies:** Task 1

**Files likely touched:**
- `src/lib/api-key-requests/contracts.ts`
- `src/lib/api-key-requests/contracts.test.ts`
- `src/lib/api-key-requests/auth.ts`
- `src/lib/api-key-requests/auth.test.ts`

**Estimated scope:** Medium

## Task 3: Build And Test The Turso Queue

**Description:** Implement the request repository against libSQL, including idempotent schema setup, unique normalized emails, pending listing, delivery metadata, approval transitions, and distributed throttling. Exercise it against a temporary local SQLite database before using remote Turso.

**Acceptance criteria:**
- [ ] A first request is inserted as pending while a duplicate normalized email is a no-op.
- [ ] Pending requests list newest first and approval transitions are atomic and reject non-pending IDs.
- [ ] Public and login throttles use hashed identifiers, bounded windows, parameterized SQL, and no raw IP storage.

**Verification:**
- [ ] `pnpm test -- src/lib/api-key-requests/repository.test.ts`
- [ ] Inspect the test database schema and uniqueness behavior.
- [ ] `pnpm exec astro check`

**Dependencies:** Task 2

**Files likely touched:**
- `src/lib/api-key-requests/database.ts`
- `src/lib/api-key-requests/repository.ts`
- `src/lib/api-key-requests/repository.test.ts`
- `src/lib/api-key-requests/types.ts`

**Estimated scope:** Medium

## Checkpoint: Foundation

- [ ] Tasks 1-3 focused tests pass.
- [ ] `pnpm exec astro check`, `pnpm lint`, and `pnpm build` pass.
- [ ] No secret is present in source, fixtures, snapshots, or built client assets.

## Task 4: Deliver Intake Emails With React Email

**Description:** Create the waiting-list and administrator templates, then implement a tested Resend service that renders React Email components and sends both messages with stable idempotency keys.

**Acceptance criteria:**
- [ ] Waiting-list and administrator emails render valid English content with escaped representative input.
- [ ] Both messages send from `REQUESTS_FROM_ADDRESS`; the administrator message targets `REQUESTS_ADMIN_EMAIL`.
- [ ] Resend failures are surfaced to the caller without logging PII, and successful message IDs can be persisted.

**Verification:**
- [ ] `pnpm test -- src/lib/api-key-requests/email.test.ts`
- [ ] Render both templates in tests and inspect HTML/plain-text output.
- [ ] `pnpm exec astro check`

**Dependencies:** Tasks 2-3

**Files likely touched:**
- `src/emails/WaitingListEmail.tsx`
- `src/emails/AdminRequestEmail.tsx`
- `src/emails/email-layout.tsx`
- `src/lib/api-key-requests/email.tsx`
- `src/lib/api-key-requests/email.test.ts`

**Estimated scope:** Medium

## Task 5: Complete The Public Intake Slice

**Description:** Write endpoint contract tests, implement `POST /api/key-requests`, and connect persistence plus both intake emails with deterministic duplicate and retry behavior.

**Acceptance criteria:**
- [ ] Valid first submissions create one pending row and record both Resend message IDs.
- [ ] Duplicate, honeypot, malformed, throttled, and dependency-failure paths return the specified generic contract and do not duplicate mail.
- [ ] Responses include `no-store`, `nosniff`, and `X-Request-ID`; logs contain request IDs but no PII.

**Verification:**
- [ ] `pnpm exec vitest run src/lib/api-key-requests/service.test.ts`
- [ ] Exercise the endpoint locally with mocked delivery and local libSQL.
- [ ] `pnpm exec astro check`

**Dependencies:** Task 4

**Files likely touched:**
- `src/pages/api/key-requests.ts`
- `src/pages/api/key-requests.test.ts`
- `src/lib/api-key-requests/service.ts`
- `src/lib/api-key-requests/service.test.ts`

**Estimated scope:** Medium

## Task 6: Add The Public Dialog And Toast

**Description:** Add an English API-key request call to action and a React Hook Form island using the native dialog and Popover APIs, preserving the existing visual language and providing required browser fallbacks.

**Acceptance criteria:**
- [ ] All approved fields, conditional details, accessible labels/errors, busy state, and server error handling work without losing recoverable input.
- [ ] Dialog focus, Escape, backdrop fallback, focus return, success close/reset, and manual-popover toast behavior are keyboard accessible.
- [ ] The layout works at 320 px and desktop widths, honors reduced motion, and uses existing tokens without a new UI dependency.

**Verification:**
- [ ] `pnpm exec astro check`
- [ ] `pnpm lint`
- [ ] Browser check: keyboard, screen-reader semantics, success/error paths, mobile and desktop.

**Dependencies:** Task 5

**Files likely touched:**
- `src/components/ApiKeyRequestDialog.tsx`
- `src/components/api-key-request-dialog.css`
- `src/pages/index.astro`

**Estimated scope:** Medium

## Checkpoint: Public Flow

- [ ] A valid browser submission reaches Turso and triggers both intake emails exactly once.
- [ ] Public validation, throttling, duplicate, and delivery-failure behavior matches the spec.
- [ ] Public keyboard and responsive browser checks pass without console errors.

## Task 7: Complete Admin Authentication

**Description:** Implement tested login/logout endpoints, Turso-backed login throttling, signed session cookies, origin checks, and the environment-configured on-demand admin entry page.

**Acceptance criteria:**
- [ ] Valid credentials create an eight-hour `Secure`, `HttpOnly`, `SameSite=Strict` session; invalid credentials remain generic and rate-limited.
- [ ] Logout expires the cookie and state-changing requests with absent, expired, tampered, or cross-origin sessions fail.
- [ ] `/admin/{REQUESTS_ADMIN_PATH}` is unlinked, rejects the wrong path, is on demand, and returns `noindex`, `no-store`, no-referrer, and frame-denial headers.

**Verification:**
- [ ] `pnpm exec vitest run src/lib/api-key-requests/admin-session-route.test.ts src/lib/api-key-requests/admin-session.test.ts`
- [ ] Browser check: invalid login, valid login, refresh, expiry simulation, and logout.
- [ ] Inspect cookies and response headers in browser DevTools.

**Dependencies:** Tasks 2-3

**Files likely touched:**
- `src/pages/api/admin/session.ts`
- `src/pages/api/admin/session.test.ts`
- `src/pages/admin/[accessPath].astro`
- `src/middleware.ts`
- `src/lib/api-key-requests/admin-guard.ts`

**Estimated scope:** Medium

## Task 8: Complete The Admin Queue Slice

**Description:** Expose pending requests through a protected endpoint and build the English login/queue interface with explicit loading, empty, authentication, and retry states.

**Acceptance criteria:**
- [ ] Only a valid session can fetch pending requests, and the endpoint never returns delivery internals or secrets.
- [ ] The panel displays every approved request field newest first and supports login/logout without exposing credentials in URLs or browser storage.
- [ ] Pending, empty, loading, and friendly error states are accessible and responsive.

**Verification:**
- [ ] `pnpm exec vitest run src/lib/api-key-requests/admin-session-route.test.ts`
- [ ] `pnpm exec astro check`
- [ ] Browser check: protected access, queue order, empty/error states, mobile and desktop.

**Dependencies:** Task 7

**Files likely touched:**
- `src/pages/api/admin/key-requests/index.ts`
- `src/pages/api/admin/key-requests/index.test.ts`
- `src/components/AdminRequests.tsx`
- `src/components/admin-requests.css`

**Estimated scope:** Medium

## Task 9: Complete Manual Approval Delivery

**Description:** Add the approval template, tested protected endpoint, and panel control that accepts an API key twice, sends it with Resend, and removes the approved request from the pending queue without persisting the key.

**Acceptance criteria:**
- [ ] The API key must be non-empty and match its confirmation; it exists only in request memory and the outbound email payload.
- [ ] A successful send records the approval message ID and approved timestamp, then removes the row from the pending response.
- [ ] Missing sessions, invalid origins/IDs, already-approved requests, Resend failures, and database failures have tested safe behavior with no key in logs or responses.

**Verification:**
- [ ] `pnpm exec vitest run src/lib/api-key-requests/approval.test.ts src/lib/api-key-requests/denial.test.ts src/lib/api-key-requests/email.test.tsx`
- [ ] Browser check: failed and successful approval, focus/error announcement, and queue update.
- [ ] Search source, logs, database rows, and built assets for the test API key; expect no persisted match.

**Dependencies:** Tasks 4 and 8

**Files likely touched:**
- `src/emails/ApiKeyApprovedEmail.tsx`
- `src/pages/api/admin/key-requests/[id]/approve.ts`
- `src/pages/api/admin/key-requests/approve.test.ts`
- `src/components/AdminRequests.tsx`
- `src/lib/api-key-requests/email.tsx`

**Estimated scope:** Medium

## Checkpoint: Complete Flow

- [ ] Applicant intake, administrator notification, login, queue listing, approval, and API-key delivery work end to end.
- [ ] The issued API key is absent from Turso, logs, responses, source, and client assets.
- [ ] Authentication, authorization, origin checks, and rate limits reject abuse cases.

## Task 10: Production Verification And Review

**Description:** Run the complete quality gate, dependency/security audit, browser matrix, and the repository-mandated focused code review. Fix only confirmed issues within the approved scope.

**Acceptance criteria:**
- [ ] Full tests, Astro check, lint, build, and production dependency audit pass or have a documented non-reachable advisory decision.
- [ ] Chromium browser verification passes at mobile and desktop sizes with no console or network errors.
- [ ] Focused TypeScript/React, accessibility, and security review has no blocking findings.

**Verification:**
- [ ] `pnpm test`
- [ ] `pnpm exec astro check`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm audit --prod`
- [ ] Inspect `dist/` for server secret names and a known test API key.

**Dependencies:** Tasks 1-9

**Files likely touched:**
- `docs/api-key-requests-spec.md`
- `tasks/plan.md`
- `tasks/todo.md`
- Feature files only when verification exposes a confirmed defect

**Estimated scope:** Small

## Parallelization

- Tasks 2 and the email-template portion of Task 4 can proceed in parallel only after Task 1, but repository and delivery integration remain sequential.
- Task 7 can proceed after Tasks 2-3 while Tasks 4-6 complete, because both slices share only stable contracts.
- Tasks 8-9 remain sequential because approval depends on the authenticated queue UI.
- Task 10 starts only after both public and admin checkpoints pass.

## Risks And Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Competing or interrupted admin decisions | High | Reserve one decision before delivery, use stable Resend idempotency keys, and allow retries only for the reserved decision |
| Serverless instances bypass in-memory throttles | High | Store bounded hashed-identifier counters in Turso |
| Hidden URL is mistaken for authorization | Critical | Authenticate every admin endpoint independently and test direct endpoint access |
| API key leaks through persistence or diagnostics | Critical | Never pass it to repository/logging code; scan database, logs, source, and build artifacts |
| Runtime schema creation races | Medium | Use idempotent SQLite DDL and test concurrent initialization |
| Applicant PII appears in error telemetry | High | Structured logs contain request ID and failure class only |
| New email/domain configuration fails in production | Medium | Validate required env at startup and perform an explicit controlled smoke test before launch |

## Open Questions

None. Implementation starts only after this plan is approved.
