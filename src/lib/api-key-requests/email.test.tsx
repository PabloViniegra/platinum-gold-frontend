import { render } from "react-email";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminRequestEmail } from "../../emails/AdminRequestEmail";
import { ApiKeyApprovedEmail } from "../../emails/ApiKeyApprovedEmail";
import { ApiKeyDeniedEmail } from "../../emails/ApiKeyDeniedEmail";
import { WaitingListEmail } from "../../emails/WaitingListEmail";
import { API_KEY_USE_CASE, type ApiKeyRequest } from "./contracts";
import {
	createEmailTransport,
	parseMailboxConfig,
	sendIntakeEmails,
	sendApprovalEmail,
	sendDenialEmail,
	sendWaitingListEmail,
	type EmailMessage,
	type EmailTransport,
	type MailboxConfig,
} from "./email";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const REQUEST: ApiKeyRequest = {
	firstName: "<Isaac>",
	lastName: "Moriah",
	email: "isaac@example.com",
	country: "Spain",
	occupation: "Frontend developer",
	useCase: API_KEY_USE_CASE.RESEARCH,
	useCaseDetails: null,
	honeypotTriggered: false,
};

const MAILBOX: MailboxConfig = {
	fromAddress: "Docs <api@mail.test>",
	adminAddress: "ops@mail.test",
};

class RecordingTransport implements EmailTransport {
	readonly messages: EmailMessage[] = [];
	readonly idempotencyKeys: string[] = [];

	async send(message: EmailMessage, idempotencyKey: string): Promise<string> {
		this.messages.push(message);
		this.idempotencyKeys.push(idempotencyKey);
		return `email-${this.messages.length}`;
	}
}

class FailingTransport implements EmailTransport {
	async send(): Promise<string> {
		throw new Error("Email delivery failed.");
	}
}

describe("React Email intake templates", () => {
	it("renders waiting-list content and escapes applicant data", async () => {
		const html = await render(<WaitingListEmail firstName={REQUEST.firstName} />);
		const text = await render(<WaitingListEmail firstName={REQUEST.firstName} />, { plainText: true });

		expect(html).toContain("Your request is in the queue");
		expect(html).toContain("&lt;Isaac&gt;");
		expect(html).not.toContain("<<Isaac>>");
		expect(text).toContain("YOUR REQUEST IS IN THE QUEUE");
	});

	it("renders every submitted field in the administrator notification", async () => {
		const html = await render(<AdminRequestEmail request={REQUEST} requestId="request-1" />);

		expect(html).toContain("isaac@example.com");
		expect(html).toContain("Frontend developer");
		expect(html).toContain("Research");
		expect(html).toContain("request-1");
	});

	it("renders the approved key and server-side handling reminder", async () => {
		const html = await render(<ApiKeyApprovedEmail firstName="Isaac" apiKey="pg_test_123" />);

		expect(html).toContain("pg_test_123");
		expect(html).toContain("never include it in a public browser bundle");
	});

	it("renders a denial without an API key", async () => {
		const html = await render(<ApiKeyDeniedEmail firstName="Isaac" />);

		expect(html).toContain("Your request was not approved");
		expect(html).not.toContain("X-API-Key");
	});
});

describe("sendIntakeEmails", () => {
	it("accepts valid mailbox configuration and rejects quoted or malformed addresses", () => {
		expect(parseMailboxConfig("Platinum Gold <api@send.example.com>", "ops@example.com"))
			.toEqual({
				fromAddress: "Platinum Gold <api@send.example.com>",
				adminAddress: "ops@example.com",
			});
		expect(parseMailboxConfig('"Platinum Gold <api@send.example.com>"', "ops@example.com"))
			.toBeNull();
		expect(parseMailboxConfig("api@send.example.com", "not-an-email")).toBeNull();
	});

	it("sends applicant and administrator emails with stable idempotency keys", async () => {
		const transport = new RecordingTransport();

		const result = await sendIntakeEmails(transport, REQUEST, "request-1", MAILBOX);

		expect(result).toEqual({ applicantEmailId: "email-1", adminEmailId: "email-2" });
		expect(transport.messages.map((message) => message.to)).toEqual([
			"isaac@example.com",
			MAILBOX.adminAddress,
		]);
		expect(transport.messages.every(
			(message) => message.from === MAILBOX.fromAddress,
		)).toBe(true);
		expect(transport.idempotencyKeys).toEqual([
			"waiting-list/request-1",
			"admin-notification/request-1",
		]);
		expect(transport.messages.map((message) => message.tags)).toEqual([
			[
				{ name: "application", value: "platinum-gold" },
				{ name: "event", value: "waiting-list" },
			],
			[
				{ name: "application", value: "platinum-gold" },
				{ name: "event", value: "admin-notification" },
			],
		]);
	});

	it("surfaces delivery failures to the caller", async () => {
		await expect(sendIntakeEmails(new FailingTransport(), REQUEST, "request-1", MAILBOX))
			.rejects.toThrow("Email delivery failed");
	});

	it("reports safe provider diagnostics without message data", async () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined);
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
			name: "validation_error",
			message: "The recipient address is invalid.",
			statusCode: 422,
		}), {
			status: 422,
			headers: { "Content-Type": "application/json" },
		})));
		const failures: [string, string, string, number | null][] = [];
		const transport = createEmailTransport(
			"re_test",
			"request-1",
			(requestId, operation, errorName, statusCode) => {
				failures.push([requestId, operation, errorName, statusCode]);
			},
		);

		await expect(sendWaitingListEmail(transport, REQUEST, "stored-1", MAILBOX))
			.rejects.toThrow("Email delivery failed");
		expect(failures).toEqual([["request-1", "waiting-list", "validation_error", 422]]);
	});

	it("sends approval with an event-scoped idempotency key", async () => {
		const transport = new RecordingTransport();

		await sendApprovalEmail(transport, "isaac@example.com", "Isaac", "pg_test_123", "request-1", MAILBOX);

		expect(transport.messages[0]?.to).toBe("isaac@example.com");
		expect(transport.idempotencyKeys).toEqual(["api-key-approved/request-1"]);
	});

	it("sends denial with an event-scoped idempotency key", async () => {
		const transport = new RecordingTransport();

		await sendDenialEmail(transport, "isaac@example.com", "Isaac", "request-1", MAILBOX);

		expect(transport.messages[0]?.to).toBe("isaac@example.com");
		expect(transport.idempotencyKeys).toEqual(["api-key-denied/request-1"]);
	});
});
