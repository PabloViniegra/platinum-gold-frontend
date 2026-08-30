import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import {
	beginRequestDecision,
	consumeRateLimit,
	createPendingRequest,
	DECISION_LEASE_MILLISECONDS,
	findStoredRequest,
	initializeRequestsSchema,
	listPendingRequests,
	markRequestApproved,
	markRequestDenied,
	recordAdminDelivery,
	recordApplicantDelivery,
	releaseRequestDecision,
	REQUEST_STATUS,
} from "./repository";

const REQUEST: ApiKeyRequest = {
	firstName: "Isaac",
	lastName: "Moriah",
	email: "Isaac@Example.com",
	country: "Spain",
	occupation: "Frontend developer",
	useCase: API_KEY_USE_CASE.RESEARCH,
	useCaseDetails: null,
	honeypotTriggered: false,
};

describe("API key request repository", () => {
	let client: Client;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		await initializeRequestsSchema(client);
	});

	afterEach(() => {
		client.close();
	});

	it("creates one pending request per normalized email", async () => {
		const created = await createPendingRequest(
			client,
			REQUEST,
			"request-1",
			"2026-08-30T12:00:00.000Z",
		);
		const duplicate = await createPendingRequest(
			client,
			{ ...REQUEST, email: " isaac@example.com " },
			"request-2",
			"2026-08-30T12:01:00.000Z",
		);

		expect(created).toBe(true);
		expect(duplicate).toBe(false);
		expect(await listPendingRequests(client)).toHaveLength(1);
	});

	it("lists pending requests newest first with their submitted fields", async () => {
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
		await createPendingRequest(
			client,
			{ ...REQUEST, email: "eden@example.com", firstName: "Eden" },
			"request-2",
			"2026-08-30T12:01:00.000Z",
		);

		const requests = await listPendingRequests(client);

		expect(requests.map((request) => request.id)).toEqual(["request-2", "request-1"]);
		expect(requests[0]).toMatchObject({
			firstName: "Eden",
			email: "eden@example.com",
			useCase: API_KEY_USE_CASE.RESEARCH,
		});
	});

	it("records deliveries and approves a pending request only once", async () => {
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
		await recordApplicantDelivery(client, "request-1", "applicant-email");
		expect(await findStoredRequest(client, REQUEST.email)).toMatchObject({
			id: "request-1",
			applicantEmailId: "applicant-email",
			adminEmailId: null,
			request: { firstName: "Isaac", email: "Isaac@Example.com" },
		});
		await recordAdminDelivery(client, "request-1", "admin-email");
		await beginRequestDecision(client, "request-1", REQUEST_STATUS.APPROVING, "fingerprint", "owner-a", 120_000);

		expect(await markRequestApproved(
			client,
			"request-1",
			"approval-email",
			"2026-08-30T13:00:00.000Z",
		)).toBe(true);
		expect(await markRequestApproved(
			client,
			"request-1",
			"second-email",
			"2026-08-30T13:01:00.000Z",
		)).toBe(false);
		expect(await listPendingRequests(client)).toEqual([]);
	});

	it("denies a pending request only once", async () => {
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
		await beginRequestDecision(client, "request-1", REQUEST_STATUS.DENYING, null, "owner-a", 120_000);

		expect(await markRequestDenied(
			client,
			"request-1",
			"denial-email",
			"2026-08-30T13:00:00.000Z",
		)).toBe(true);
		expect(await markRequestDenied(
			client,
			"request-1",
			"second-email",
			"2026-08-30T13:01:00.000Z",
		)).toBe(false);
		expect(await listPendingRequests(client)).toEqual([]);
		expect(await findStoredRequest(client, REQUEST.email)).toMatchObject({
			status: "denied",
		});
	});

	it("resumes a decision only after its lease expires or is released", async () => {
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");

		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.APPROVING, "fp", "owner-a", 120_000,
		)).not.toBeNull();
		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.APPROVING, "fp", "owner-b", 120_001,
		)).toBeNull();
		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.APPROVING, "other", "owner-b", 120_001,
		)).toBeNull();

		await releaseRequestDecision(client, "request-1", REQUEST_STATUS.APPROVING, "owner-a");
		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.APPROVING, "fp", "owner-b", 120_002,
		)).not.toBeNull();

		expect(await markRequestApproved(
			client, "request-1", "approval-email", "2026-08-30T13:00:00.000Z",
		)).toBe(true);
	});

	it("resumes a claimed decision once the lease lapses", async () => {
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
		await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.DENYING, null, "owner-a", 120_000,
		);

		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.DENYING, null, "owner-b",
			120_000 + DECISION_LEASE_MILLISECONDS - 1,
		)).toBeNull();
		expect(await beginRequestDecision(
			client, "request-1", REQUEST_STATUS.DENYING, null, "owner-b",
			120_000 + DECISION_LEASE_MILLISECONDS,
		)).not.toBeNull();
	});

	it("migrates a legacy table and preserves rows and claims", async () => {
		await client.execute("DROP TABLE api_key_requests");
		await client.execute(`CREATE TABLE api_key_requests (
			id TEXT PRIMARY KEY,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			email TEXT NOT NULL,
			email_normalized TEXT NOT NULL UNIQUE,
			country TEXT NOT NULL,
			occupation TEXT NOT NULL,
			use_case TEXT NOT NULL,
			use_case_details TEXT,
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
			created_at TEXT NOT NULL,
			approved_at TEXT,
			applicant_email_id TEXT,
			admin_email_id TEXT,
			approval_email_id TEXT
		)`);
		await client.execute({
			sql: `INSERT INTO api_key_requests (
				id, first_name, last_name, email, email_normalized, country,
				occupation, use_case, use_case_details, status, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
			args: [
				"legacy-1", "Isaac", "Moriah", "legacy@example.com", "legacy@example.com",
				"Spain", "Teacher", "research", null, "2026-08-30T12:00:00.000Z",
			],
		});

		await initializeRequestsSchema(client);

		expect(await beginRequestDecision(
			client, "legacy-1", REQUEST_STATUS.APPROVING, "fp", "owner-a", 120_000,
		)).toMatchObject({ id: "legacy-1", status: REQUEST_STATUS.APPROVING });
		expect(await client.execute("SELECT decision_fingerprint FROM api_key_requests WHERE id = 'legacy-1'"))
			.toMatchObject({ rows: [{ decision_fingerprint: "fp" }] });
	});

	it("enforces a rate limit per action, identifier, and time window", async () => {
		const first = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_000);
		const second = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_001);
		const blocked = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_002);
		const nextWindow = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 180_000);

		expect([first, second, blocked, nextWindow]).toEqual([true, true, false, true]);
		const rows = await client.execute("SELECT window_start FROM request_rate_limits ORDER BY window_start");
		expect(rows.rows.map((row) => row.window_start)).toEqual([180_000]);
	});
});
