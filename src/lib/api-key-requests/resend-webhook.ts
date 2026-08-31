import type { Client } from "@libsql/client";
import type { WebhookEventPayload } from "resend";

import { readBoundedBody } from "./http-body";
import {
	EMAIL_DELIVERY_STATUS,
	reconcileIntakeDelivery,
	recordEmailDeliveryEvent,
	type EmailDeliveryStatus,
} from "./repository";

export type ResendWebhookVerifier = (
	payload: string,
	id: string,
	timestamp: string,
	signature: string,
	secret: string,
) => WebhookEventPayload;

const MAXIMUM_WEBHOOK_BYTES = 128 * 1_024;

function response(status: number): Response {
	return new Response(null, {
		status,
		headers: {
			"Cache-Control": "no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function eventStatus(event: WebhookEventPayload): EmailDeliveryStatus | null {
	switch (event.type) {
		case "email.sent":
			return EMAIL_DELIVERY_STATUS.SENT;
		case "email.delivered":
			return EMAIL_DELIVERY_STATUS.DELIVERED;
		case "email.delivery_delayed":
			return EMAIL_DELIVERY_STATUS.DELAYED;
		case "email.complained":
			return EMAIL_DELIVERY_STATUS.COMPLAINED;
		case "email.bounced":
			return EMAIL_DELIVERY_STATUS.BOUNCED;
		case "email.failed":
			return EMAIL_DELIVERY_STATUS.FAILED;
		case "email.suppressed":
			return EMAIL_DELIVERY_STATUS.SUPPRESSED;
		default:
			return null;
	}
}

function header(request: Request, name: string): string {
	return request.headers.get(`webhook-${name}`)
		?? request.headers.get(`svix-${name}`)
		?? "";
}

export async function handleResendWebhook(
	request: Request,
	client: Client,
	secret: string,
	verify: ResendWebhookVerifier,
	recordedAt: string,
): Promise<Response> {
	const body = await readBoundedBody(request, MAXIMUM_WEBHOOK_BYTES);
	if (body === null) return response(413);
	const id = header(request, "id");
	const timestamp = header(request, "timestamp");
	const signature = header(request, "signature");
	if (!id || !timestamp || !signature) return response(401);

	let event: WebhookEventPayload;
	try {
		event = verify(body, id, timestamp, signature, secret);
	} catch {
		return response(401);
	}

	if (event === null || event.constructor !== Object || event.data?.constructor !== Object) {
		return response(400);
	}
	const status = eventStatus(event);
	if (!status) return response(204);
	if (!("tags" in event.data) || event.data.tags?.application !== "platinum-gold") return response(204);
	if (event.created_at?.constructor !== String) return response(400);
	const eventCreatedAtMilliseconds = Date.parse(event.created_at);
	if (!("email_id" in event.data) || event.data.email_id?.constructor !== String || event.data.email_id.length > 100
		|| !Number.isFinite(eventCreatedAtMilliseconds)) {
		return response(400);
	}

	try {
		await recordEmailDeliveryEvent(
			client, event.data.email_id, status, eventCreatedAtMilliseconds, recordedAt,
		);
		const emailEvent = event.data.tags?.event;
		const requestId = event.data.tags?.request_id;
		if (requestId?.constructor === String && requestId.length <= 100
			&& (emailEvent === "waiting-list" || emailEvent === "admin-notification")) {
			await reconcileIntakeDelivery(client, requestId, emailEvent, event.data.email_id);
		}
		return response(204);
	} catch {
		return response(503);
	}
}
