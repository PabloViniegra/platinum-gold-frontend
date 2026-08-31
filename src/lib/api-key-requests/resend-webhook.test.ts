import { createClient, type Client } from "@libsql/client";
import type { WebhookEventPayload } from "resend";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findEmailDeliveryStatus, initializeRequestsSchema } from "./repository";
import { handleResendWebhook, type ResendWebhookVerifier } from "./resend-webhook";

const DELIVERED_EVENT: WebhookEventPayload = {
	type: "email.delivered",
	created_at: "2026-08-31T10:00:00.000Z",
	data: {
		created_at: "2026-08-31T09:59:59.000Z",
		email_id: "email-1",
		message_id: "message-1",
		from: "Platinum Gold <api@send.example.com>",
		to: ["isaac@example.com"],
		subject: "Your Platinum Gold API request",
		tags: { application: "platinum-gold", event: "waiting-list" },
	},
};

function webhookRequest(headers: Record<string, string> = {
	"webhook-id": "event-1",
	"webhook-timestamp": "1788160800",
	"webhook-signature": "signature-1",
}): Request {
	return new Request("https://example.com/api/webhooks/resend", {
		method: "POST",
		headers,
		body: JSON.stringify(DELIVERED_EVENT),
	});
}

describe("Resend webhook", () => {
	let client: Client;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		await initializeRequestsSchema(client);
	});

	afterEach(() => {
		client.close();
	});

	it("verifies the raw request and records Platinum Gold delivery events", async () => {
		const verified: string[][] = [];
		const verifier: ResendWebhookVerifier = (payload, id, timestamp, signature, secret) => {
			verified.push([payload, id, timestamp, signature, secret]);
			return DELIVERED_EVENT;
		};

		const response = await handleResendWebhook(
			webhookRequest(),
			client,
			"whsec_test",
			verifier,
			"2026-08-31T10:00:01.000Z",
		);

		expect(response.status).toBe(204);
		expect(verified).toHaveLength(1);
		expect(verified[0]?.slice(1)).toEqual([
			"event-1",
			"1788160800",
			"signature-1",
			"whsec_test",
		]);
		expect(await findEmailDeliveryStatus(client, "email-1")).toBe("delivered");
	});

	it("accepts legacy Svix header names during Resend's header transition", async () => {
		const verifier: ResendWebhookVerifier = (payload, id, timestamp, signature, secret) => {
			expect([id, timestamp, signature, secret]).toEqual([
				"event-1",
				"1788160800",
				"signature-1",
				"whsec_test",
			]);
			expect(payload).toContain("email.delivered");
			return DELIVERED_EVENT;
		};

		const response = await handleResendWebhook(webhookRequest({
			"svix-id": "event-1",
			"svix-timestamp": "1788160800",
			"svix-signature": "signature-1",
		}), client, "whsec_test", verifier, "2026-08-31T10:00:01.000Z");

		expect(response.status).toBe(204);
	});

	it("rejects unsigned or invalid webhook requests", async () => {
		const verifier: ResendWebhookVerifier = () => {
			throw new Error("Invalid signature");
		};

		expect((await handleResendWebhook(
			webhookRequest({}), client, "whsec_test", verifier, "2026-08-31T10:00:01.000Z",
		)).status).toBe(401);
		expect(await findEmailDeliveryStatus(client, "email-1")).toBeNull();
	});

	it("ignores verified events tagged for another application", async () => {
		const foreignEvent: WebhookEventPayload = {
			...DELIVERED_EVENT,
			data: {
				...DELIVERED_EVENT.data,
				tags: { application: "another-app", event: "waiting-list" },
			},
		};
		const verifier: ResendWebhookVerifier = () => foreignEvent;

		expect((await handleResendWebhook(
			webhookRequest(), client, "whsec_test", verifier, "2026-08-31T10:00:01.000Z",
		)).status).toBe(204);
		expect(await findEmailDeliveryStatus(client, "email-1")).toBeNull();
	});
});
