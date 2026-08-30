import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import {
	consumeRateLimit,
	createPendingRequest,
	findStoredRequest,
	initializeRequestsSchema,
	listPendingRequests,
	markRequestApproved,
	markRequestDenied,
	recordAdminDelivery,
	recordApplicantDelivery,
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

	it("enforces a rate limit per action, identifier, and time window", async () => {
		const first = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_000);
		const second = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_001);
		const blocked = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 120_002);
		const nextWindow = await consumeRateLimit(client, "public-form", "hashed-ip", 2, 60_000, 180_000);

		expect([first, second, blocked, nextWindow]).toEqual([true, true, false, true]);
	});
});
