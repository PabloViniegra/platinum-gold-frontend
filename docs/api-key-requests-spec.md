# Spec: API Key Request Queue

## Assumptions

1. All public UI, admin UI, toast messages, and emails are written in English.
2. The public form opens from the primary navigation on every public page, and from the homepage hero. It does not replace the existing documentation flow.
3. `country` is chosen from a server-provided country list (Nager.Date, with a fallback list). `occupation` is chosen from a fixed English list. `useCase` is one of `personal_project`, `research`, `education`, `commercial_evaluation`, or `other`; `useCaseDetails` is required only for `other`.
4. One normalized email address can have one request. A second submit for an email already pending or approved returns `409` and does not send mail. A retry is allowed only when a previous attempt is still missing an intake email.
5. The administrator can approve (manual API key) or deny a pending request. API key generation remains outside this feature.
6. The API key is entered manually during approval, sent to the applicant, and never stored in Turso or logs.
7. The admin route uses an environment-configured path segment, has no public link, and sends `noindex` headers. This obscures discovery but is not treated as authentication.

## Objective

Allow a frontend developer to request access to the Platinum Gold API from an accessible contact modal. Persist the request in a Turso-backed SQLite queue, acknowledge it by email, notify the administrator, and provide a protected admin panel where the administrator can approve a request and manually supply the API key that will be emailed to the applicant.

### Public flow

1. The user opens a native modal dialog from the public site.
2. The form collects first name, last name, email, country, occupation, use case, and conditional use-case details.
3. React Hook Form validates the client experience; the server independently validates and normalizes every value.
4. A successful first submission creates a pending request, sends the waiting-list email to the applicant, and sends a notification email to `REQUESTS_ADMIN_EMAIL`.
5. The modal closes and an accessible success toast confirms that the request joined the waiting list. Failures keep the entered values and show a friendly error toast.

### Admin flow

1. The administrator visits `/admin/{REQUESTS_ADMIN_PATH}`. The route is absent from navigation and search indexing.
2. A valid username and password create an eight-hour signed session in a `Secure`, `HttpOnly`, `SameSite=Strict` cookie.
3. The protected panel lists pending requests newest first and shows all submitted fields.
4. Approving requires manually entering and confirming an API key. Denying sends a rejection email and does not include a key.
5. The server sends the decision email before marking the request approved or denied. The key is not persisted or included in diagnostics.

## Tech Stack

- Astro 7 on-demand routes with the existing Vercel adapter
- React 19 islands
- React Hook Form for the public request form
- `@libsql/client` for Turso
- Resend Node SDK for transactional delivery
- React Email 6 components for every email template
- Node `crypto` primitives for password verification, signed sessions, identifiers, and rate-limit keys
- Vitest for contract and server-logic tests

## Contracts

### `POST /api/key-requests`

Input:

```ts
type ApiKeyRequestInput = {
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: "personal_project" | "research" | "education" | "commercial_evaluation" | "other";
	useCaseDetails?: string;
};
```

- Returns `201` with `{ "message": "Your request has joined the waiting list." }` for a newly accepted request.
- Returns `409` with `{ "message": "A request for this email is already being reviewed." }` when that email is already pending with both intake emails recorded, or already approved.
- Returns `400` for malformed input, `429` when throttled, and `503` when the request cannot be accepted safely.
- Every response is `Cache-Control: no-store` and includes an `X-Request-ID`.

### Admin endpoints

- `POST /api/admin/session`: verifies credentials and creates the signed cookie.
- `DELETE /api/admin/session`: expires the signed cookie.
- `GET /api/admin/key-requests`: returns pending requests only after authentication.
- `POST /api/admin/key-requests/{id}/approve`: validates the session, origin, request ID, and submitted API key; sends the approval email and marks the request approved.
- `POST /api/admin/key-requests/{id}/deny`: validates the session and origin; sends a rejection email and marks the request denied.
- Unauthenticated requests receive `401`; invalid state transitions receive `409`; validation failures receive `400`; internal details are never returned.

### Persistence

The `api_key_requests` table stores a UUID, normalized/display email, submitted fields, status, timestamps, and Resend message IDs. Public states are `pending`, `approved`, and `denied`. Internal `approving` and `denying` reservations prevent competing decisions from sending contradictory emails: one handler atomically claims the decision with an owner token and a ten-minute lease, releases it when delivery fails, and a crashed claim resumes only after the lease lapses. Approval additionally pins a keyed hash of the submitted API key so retries cannot change the emailed key. A unique constraint on normalized email prevents duplicate queue entries. A small `request_rate_limits` table stores bounded hashed-identifier counters; raw IP addresses are not persisted.

Schema creation is idempotent and runs server-side before first use. All SQL values use libSQL parameters.

## Email Contract

All templates are React Email components and use both HTML and plain-text-compatible content.

- Sender: `REQUESTS_FROM_ADDRESS`
- Waiting-list email: confirms receipt and explains that access is reviewed manually.
- Administrator notification: sent to `REQUESTS_ADMIN_EMAIL` with the request details, but never an API key.
- Approval email: contains the manually entered API key and a reminder to keep it out of public browser bundles.
- Resend idempotency keys are scoped by event and request UUID to prevent duplicate delivery during safe retries.

## Security Model

### Trust boundaries and assets

- Public form input, admin credentials, request IDs, and API keys are untrusted HTTP input.
- Turso credentials, Resend credentials, admin credentials, the session secret, applicant PII, and issued API keys are protected assets.
- Resend and Turso responses are external data and must be checked before state changes.

### Controls

- Validate field types, pinned canonical country and occupation catalogs, allowlisted use cases, trimmed lengths, and body size at the server boundary. The public country dropdown only offers names inside the canonical catalog, so UI and validation agree across instances.
- Use a honeypot plus hashed-IP/email throttling for public submissions.
- Store only a scrypt password hash in `REQUESTS_ADMIN_PASSWORD_HASH`; compare derived values in constant time.
- Sign expiring session data with `REQUESTS_SESSION_SECRET`; never use browser storage for authentication.
- Check `Origin` on every state-changing admin request and use `SameSite=Strict` cookies.
- Rate-limit failed login attempts and return one generic authentication error.
- Never log request bodies, email addresses, credentials, session values, or API keys.
- Add `no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and frame-denial headers to admin responses.

## Environment

Required server-only variables:

```text
RESEND_API_KEY
REQUESTS_TURSO_DB
REQUESTS_TURSO_TOKEN
REQUESTS_ADMIN_PATH
REQUESTS_ADMIN_USERNAME
REQUESTS_ADMIN_PASSWORD_HASH
REQUESTS_SESSION_SECRET
REQUESTS_FROM_ADDRESS
REQUESTS_ADMIN_EMAIL
```

The existing `.env` already contains the Resend and Turso values. New values will be documented with placeholders in `.env.example`; no real value is committed.

## Project Structure

```text
src/components/ApiKeyRequestDialog.tsx  Public React form, dialog, and toast
src/components/AdminRequests.tsx        Authenticated queue and approval UI
src/emails/                             Waiting-list, admin, and approval templates
src/lib/api-key-requests/               Validation, Turso repository, email, and auth modules
src/pages/api/                          Public and protected server endpoints
src/pages/admin/[accessPath].astro      Unlinked on-demand admin entry
src/styles/                             Existing design tokens and feature styles
docs/api-key-requests-spec.md           Feature contract and acceptance criteria
tasks/plan.md                           Approved implementation plan
tasks/todo.md                           Ordered implementation checklist
```

## Code Style

Use strict, narrow TypeScript contracts and explicit boundary parsing. Keep transport, persistence, and email concerns separate without adding generic framework abstractions.

```ts
const useCases = [
	"personal_project",
	"research",
	"education",
	"commercial_evaluation",
	"other",
] as const;

type UseCase = (typeof useCases)[number];
```

Follow the repository's tab indentation in Astro/React files and satisfy all `anti-slop/*` lint rules. Do not use type assertions unless the existing safety-comment rule is met.

## UX And Accessibility

- Preserve the existing dark-room, aged-paper, square-corner visual language and design tokens.
- Use `<dialog>` with `showModal()`, an accessible name, Escape support, focus return, and a Safari-compatible backdrop-click fallback.
- Associate every label and error, expose `aria-invalid`, and announce validation and submission results without relying on color alone.
- Keep submit enabled, show a busy state during submission, and prevent duplicate in-flight requests.
- Implement the toast as a manual popover with a close control and an `aria-live` region; include a fixed-position fallback where Popover is unavailable.
- Support keyboard-only operation, reduced motion, 320 px mobile layouts, and desktop layouts without horizontal overflow.

## Commands

- Install: `pnpm install --frozen-lockfile`
- Development: `pnpm dev`
- Tests: `pnpm test`
- Type check: `pnpm exec astro check`
- Lint: `pnpm lint`
- Production build: `pnpm build`
- Dependency audit: `pnpm audit --prod`

## Testing Strategy

- Unit-test input normalization, length limits, use-case rules, duplicate behavior, session signing/expiry, password verification, and rate-limit decisions with Vitest.
- Test repository behavior against a temporary local libSQL database, including uniqueness and approval state transitions.
- Test endpoint contracts with an injected Resend transport, including partial failures, competing decisions, and idempotent retries.
- Verify all three React Email templates render with representative and escaped user data.
- Run browser checks for dialog focus, field errors, success/error toast announcements, admin login/logout, approval, responsive layout, headers, and absence of console errors.
- Inspect the production client output to confirm that no server secret or submitted API key is bundled.

## Boundaries

- Always: validate on the server, parameterize SQL, use server-only environment imports, preserve applicant input after recoverable errors, use generic public/auth errors, and keep the API key ephemeral.
- Ask first: adding rejection emails, changing the one-request-per-email rule, persisting an issued API key, or introducing a third-party authentication service.
- Never: expose secrets through `PUBLIC_`/`VITE_`, rely on the hidden URL for authorization, store plaintext admin passwords, log PII/API keys, or send emails directly from the browser.

## Success Criteria

- A valid submission creates exactly one pending Turso row and sends exactly one waiting-list email plus one administrator notification.
- Invalid, oversized, automated, throttled, and duplicate submissions have deterministic tested behavior and leak no internal details.
- The public dialog and toast are usable with keyboard and screen reader semantics on mobile and desktop.
- Only an authenticated, unexpired admin session can read pending requests or approve one.
- Approval sends the manually entered key to the correct applicant, marks the request approved, removes it from the pending list, and never persists or logs the key.
- Every email is implemented with React Email and sent from `REQUESTS_FROM_ADDRESS`.
- Tests, Astro check, lint, production build, dependency audit, and browser verification pass.

## Open Questions

None. Implementation starts only after this specification is approved.
