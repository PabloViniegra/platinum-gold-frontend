import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ADMIN_SESSION_COOKIE, createAdminSession } from "./auth";
import { handleRequestApproval } from "./approval";
import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import type { EmailMessage, EmailTransport, MailboxConfig } from "./email";
import {
	createPendingRequest,
	initializeRequestsSchema,
	listPendingRequests,
} from "./repository";

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
	failNext = false;

	async send(message: EmailMessage): Promise<string> {
		this.messages.push(message);
		if (this.failNext) throw new Error("Email delivery failed.");
		return `email-${this.messages.length}`;
	}
}

function cookieHeader(): string {
	return `${ADMIN_SESSION_COOKIE}=${createAdminSession(USERNAME, SESSION_SECRET, NOW)}`;
}

function approvalRequest(
	origin: string,
	cookie: string,
	body: string,
): Request {
	return new Request("https://example.com/api/admin/key-requests/request-1/approve", {
		method: "POST",
		headers: {
			Origin: origin,
			Cookie: cookie,
			"Content-Type": "application/json",
		},
		body,
	});
}

describe("handleRequestApproval", () => {
	let client: Client;
	let transport: RecordingTransport;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		transport = new RecordingTransport();
		await initializeRequestsSchema(client);
		await createPendingRequest(client, REQUEST, "request-1", "2026-08-30T12:00:00.000Z");
	});

	afterEach(() => client.close());

	it("rejects cross-origin and unauthenticated approvals", async () => {
		const crossOrigin = await handleRequestApproval(
			approvalRequest("https://attacker.example", cookieHeader(), JSON.stringify({ apiKey: "k", confirmation: "k" })),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);
		const unauthenticated = await handleRequestApproval(
			approvalRequest("https://example.com", "", JSON.stringify({ apiKey: "k", confirmation: "k" })),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);

		expect(crossOrigin.status).toBe(403);
		expect(unauthenticated.status).toBe(401);
		expect(transport.messages).toEqual([]);
	});

	it("rejects mismatched API keys without sending mail", async () => {
		const response = await handleRequestApproval(
			approvalRequest("https://example.com", cookieHeader(), JSON.stringify({
				apiKey: "pg_one",
				confirmation: "pg_two",
			})),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);

		expect(response.status).toBe(400);
		expect(transport.messages).toEqual([]);
		expect(await listPendingRequests(client)).toHaveLength(1);
	});

	it("sends the key once and removes the pending request", async () => {
		const response = await handleRequestApproval(
			approvalRequest("https://example.com", cookieHeader(), JSON.stringify({
				apiKey: "pg_test_123",
				confirmation: "pg_test_123",
			})),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);
		const second = await handleRequestApproval(
			approvalRequest("https://example.com", cookieHeader(), JSON.stringify({
				apiKey: "pg_test_123",
				confirmation: "pg_test_123",
			})),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW + 1,
			MAILBOX,
		);

		expect(response.status).toBe(204);
		expect(second.status).toBe(409);
		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.to).toBe("isaac@example.com");
		expect(await listPendingRequests(client)).toEqual([]);
	});

	it("keeps the request pending when delivery fails", async () => {
		transport.failNext = true;
		const response = await handleRequestApproval(
			approvalRequest("https://example.com", cookieHeader(), JSON.stringify({
				apiKey: "pg_test_123",
				confirmation: "pg_test_123",
			})),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);

		expect(response.status).toBe(503);
		expect(await listPendingRequests(client)).toHaveLength(1);
	});
});
