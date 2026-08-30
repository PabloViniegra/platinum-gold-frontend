import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ADMIN_SESSION_COOKIE, createAdminSession } from "./auth";
import { handleRequestApproval } from "./approval";
import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import { handleRequestDenial } from "./denial";
import type { EmailMessage, EmailTransport, MailboxConfig } from "./email";
import {
	createPendingRequest,
	initializeRequestsSchema,
	listPendingRequests,
	REQUEST_STATUS,
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
		expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
		expect(second.status).toBe(409);
		expect(transport.messages).toHaveLength(1);
		expect(transport.messages[0]?.to).toBe("isaac@example.com");
		expect(await listPendingRequests(client)).toEqual([]);
	});

	it("keeps the approval reserved when delivery fails", async () => {
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
		expect(await listPendingRequests(client)).toEqual([
			expect.objectContaining({ id: "request-1", status: REQUEST_STATUS.APPROVING }),
		]);

		transport.failNext = false;
		const changedKey = await handleRequestApproval(
			approvalRequest("https://example.com", cookieHeader(), JSON.stringify({
				apiKey: "pg_different",
				confirmation: "pg_different",
			})),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW + 1,
			MAILBOX,
		);

		expect(changedKey.status).toBe(409);
		expect(transport.messages).toHaveLength(1);
	});

	it("sends one email when two approvals with the same key race", async () => {
		const approvalBody = JSON.stringify({ apiKey: "pg_test_123", confirmation: "pg_test_123" });
		const responses = await Promise.all([
			handleRequestApproval(
				approvalRequest("https://example.com", cookieHeader(), approvalBody),
				client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
			),
			handleRequestApproval(
				approvalRequest("https://example.com", cookieHeader(), approvalBody),
				client, transport, USERNAME, SESSION_SECRET, "request-1", NOW, MAILBOX,
			),
		]);

		expect(responses.map((response) => response.status).sort()).toEqual([204, 409]);
		expect(transport.messages).toHaveLength(1);
	});

	it("allows only one decision when approval and denial race", async () => {
		const approval = handleRequestApproval(
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
		const denial = handleRequestDenial(
			new Request("https://example.com/api/admin/key-requests/request-1/deny", {
				method: "POST",
				headers: { Origin: "https://example.com", Cookie: cookieHeader() },
			}),
			client,
			transport,
			USERNAME,
			SESSION_SECRET,
			"request-1",
			NOW,
			MAILBOX,
		);

		const responses = await Promise.all([approval, denial]);

		expect(responses.map((response) => response.status).sort()).toEqual([204, 409]);
		expect(transport.messages).toHaveLength(1);
	});
});
