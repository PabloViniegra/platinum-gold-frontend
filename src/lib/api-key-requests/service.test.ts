import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EmailMessage, EmailTransport, MailboxConfig } from "./email";
import { initializeRequestsSchema, listPendingRequests } from "./repository";
import { handleApiKeyRequest } from "./service";

const SECRET = "a-rate-limit-secret-that-is-longer-than-thirty-two-characters";
const MAILBOX: MailboxConfig = {
	fromAddress: "Docs <api@mail.test>",
	adminAddress: "ops@mail.test",
};

function requestBody(email = "isaac@example.com", website = ""): string {
	return JSON.stringify({
		firstName: "Isaac",
		lastName: "Moriah",
		email,
		country: "Spain",
		occupation: "Frontend developer",
		useCase: "research",
		website,
	});
}

class RecordingTransport implements EmailTransport {
	readonly messages: EmailMessage[] = [];
	failAt: number | null = null;

	async send(message: EmailMessage): Promise<string> {
		this.messages.push(message);
		if (this.failAt === this.messages.length) throw new Error("Email delivery failed.");
		return `email-${this.messages.length}`;
	}
}

describe("handleApiKeyRequest", () => {
	let client: Client;
	let transport: RecordingTransport;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		transport = new RecordingTransport();
		await initializeRequestsSchema(client);
	});

	afterEach(() => {
		client.close();
	});

	it("persists and delivers a valid request", async () => {
		const response = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody() }),
			client,
			transport,
			SECRET,
			"hashed-client-ip",
			"request-1",
			120_000,
			MAILBOX,
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual({ message: "Your request has joined the waiting list." });
		expect(transport.messages).toHaveLength(2);
		expect(await listPendingRequests(client)).toHaveLength(1);
		expect(response.headers.get("X-Request-ID")).toBe("request-1");
	});

	it("rejects a second submit while the email is already in the queue", async () => {
		const first = new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody() });
		const duplicate = new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody("ISAAC@example.com") });

		await handleApiKeyRequest(first, client, transport, SECRET, "ip-1", "request-1", 120_000, MAILBOX);
		const response = await handleApiKeyRequest(duplicate, client, transport, SECRET, "ip-1", "request-2", 120_001, MAILBOX);

		expect(response.status).toBe(409);
		expect(await response.json()).toEqual({
			message: "A request for this email is already being reviewed.",
		});
		expect(transport.messages).toHaveLength(2);
		expect(await listPendingRequests(client)).toHaveLength(1);
	});

	it("resumes only the missing email after a partial delivery failure", async () => {
		transport.failAt = 2;
		const first = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody() }),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-1",
			120_000,
			MAILBOX,
		);
		expect(first.status).toBe(503);

		transport.failAt = null;
		const retry = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody() }),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-2",
			120_001,
			MAILBOX,
		);

		expect(retry.status).toBe(201);
		expect(transport.messages.map((message) => message.to)).toEqual([
			"isaac@example.com",
			MAILBOX.adminAddress,
			MAILBOX.adminAddress,
		]);
	});

	it("resumes missing emails from the persisted request, not a later payload", async () => {
		transport.failAt = 2;
		await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody() }),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-1",
			120_000,
			MAILBOX,
		);
		transport.failAt = null;

		const retry = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", {
				method: "POST",
				body: JSON.stringify({
					firstName: "Attacker",
					lastName: "Unknown",
					email: "isaac@example.com",
					country: "France",
					occupation: "Teacher",
					useCase: "research",
				}),
			}),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-2",
			120_001,
			MAILBOX,
		);

		expect(retry.status).toBe(201);
		expect(transport.messages[2]?.subject).toBe("API access request from Isaac Moriah");
	});

	it("rejects oversized request bodies before parsing", async () => {
		const response = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", {
				method: "POST",
				body: "x".repeat(9_000),
			}),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-1",
			120_000,
			MAILBOX,
		);

		expect(response.status).toBe(400);
		expect(transport.messages).toEqual([]);
	});

	it("rejects malformed input and silently accepts a filled honeypot", async () => {
		const malformed = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: "{}" }),
			client,
			transport,
			SECRET,
			"ip-1",
			"request-1",
			120_000,
			MAILBOX,
		);
		const bot = await handleApiKeyRequest(
			new Request("https://example.com/api/key-requests", { method: "POST", body: requestBody("bot@example.com", "spam") }),
			client,
			transport,
			SECRET,
			"ip-2",
			"request-2",
			120_000,
			MAILBOX,
		);

		expect(malformed.status).toBe(400);
		expect(bot.status).toBe(201);
		expect(transport.messages).toEqual([]);
		expect(await listPendingRequests(client)).toEqual([]);
	});
});
