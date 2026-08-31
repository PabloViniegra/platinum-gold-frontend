import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ADMIN_SESSION_COOKIE, createAdminSession } from "./auth";
import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import type { EmailMessage, EmailTransport, MailboxConfig } from "./email";
import {
	claimIntakeDelivery,
	createPendingRequest,
	initializeRequestsSchema,
	recordApplicantDelivery,
} from "./repository";
import { handleIntakeRetry } from "./retry-intake";

const NOW = 120_000;
const USERNAME = "pablo";
const SESSION_SECRET = "a-session-secret-that-is-longer-than-thirty-two-characters";
const MAILBOX: MailboxConfig = {
	fromAddress: "Docs <api@mail.test>",
	adminAddress: "ops@mail.test",
};
const REQUEST: ApiKeyRequest = {
	firstName: "Isaac",
	lastName: "Moriah",
	email: "isaac@example.com",
	country: "Spain",
	occupation: "Frontend developer",
	useCase: API_KEY_USE_CASE.RESEARCH,
	useCaseDetails: null,
	honeypotTriggered: false,
};

class RecordingTransport implements EmailTransport {
	readonly messages: EmailMessage[] = [];
	failAt: number | null = null;

	async send(message: EmailMessage): Promise<string> {
		this.messages.push(message);
		if (this.failAt === this.messages.length) throw new Error("Email delivery failed.");
		return `email-${this.messages.length}`;
	}
}

function retryRequest(origin = "https://example.com", authenticated = true): Request {
	const cookie = authenticated
		? `${ADMIN_SESSION_COOKIE}=${createAdminSession(USERNAME, SESSION_SECRET, NOW)}`
		: "";
	return new Request("https://example.com/api/admin/key-requests/request-1/retry-intake", {
		method: "POST",
		headers: { Origin: origin, Cookie: cookie },
	});
}

describe("handleIntakeRetry", () => {
	let client: Client;
	let transport: RecordingTransport;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		transport = new RecordingTransport();
		await initializeRequestsSchema(client);
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
	});

	afterEach(() => client.close());

	it("rejects cross-origin and unauthenticated retries", async () => {
		expect((await handleIntakeRetry(
			retryRequest("https://attacker.example"), client, transport, USERNAME,
			SESSION_SECRET, "request-1", NOW, MAILBOX,
		)).status).toBe(403);
		expect((await handleIntakeRetry(
			retryRequest("https://example.com", false), client, transport, USERNAME,
			SESSION_SECRET, "request-1", NOW, MAILBOX,
		)).status).toBe(401);
		expect(transport.messages).toEqual([]);
	});

	it("sends and records both missing intake emails", async () => {
		const response = await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			applicantEmailAccepted: true,
			adminEmailAccepted: true,
		});
		expect(transport.messages.map((message) => message.to)).toEqual([
			REQUEST.email,
			MAILBOX.adminAddress,
		]);
	});

	it("sends only the missing administrator email", async () => {
		await recordApplicantDelivery(client, "request-1", "existing-applicant-email");

		const response = await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		);

		expect(response.status).toBe(200);
		expect(transport.messages.map((message) => message.to)).toEqual([MAILBOX.adminAddress]);
	});

	it("rejects retries while another intake delivery holds the request", async () => {
		expect(await claimIntakeDelivery(client, "request-1", "other-owner", NOW)).toBe(true);

		expect((await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		)).status).toBe(409);
		expect(transport.messages).toEqual([]);
	});

	it("rejects retries when no intake email is missing", async () => {
		await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		);

		const response = await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		);

		expect(response.status).toBe(409);
		expect(transport.messages).toHaveLength(2);
	});

	it("persists the successful send and resumes only the failed send", async () => {
		transport.failAt = 2;
		expect((await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		)).status).toBe(503);
		transport.failAt = null;

		expect((await handleIntakeRetry(
			retryRequest(), client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
		)).status).toBe(200);
		expect(transport.messages.map((message) => message.to)).toEqual([
			REQUEST.email,
			MAILBOX.adminAddress,
			MAILBOX.adminAddress,
		]);
	});
});
