import type { Client } from "@libsql/client";

import { identifierHash } from "./auth";
import { parseApiKeyRequest } from "./contracts";
import { readBoundedBody } from "./http-body";
import {
	sendAdminNotificationEmail,
	sendWaitingListEmail,
	type EmailTransport,
	type MailboxConfig,
} from "./email";
import {
	consumeRateLimit,
	createPendingRequest,
	findStoredRequest,
	recordAdminDelivery,
	recordApplicantDelivery,
	REQUEST_STATUS,
	type StoredApiKeyRequest,
} from "./repository";

const MAXIMUM_BODY_BYTES = 8_192;
const SUCCESS_MESSAGE = "Your request has joined the waiting list.";
const DUPLICATE_MESSAGE = "A request for this email is already being reviewed.";

function response(message: string, status: number, requestId: string): Response {
	return Response.json(
		{ message },
		{
			status,
			headers: {
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"X-Request-ID": requestId,
			},
		},
	);
}

export type IntakeEmailAcceptance = {
	applicantEmailAccepted: boolean;
	adminEmailAccepted: boolean;
};

export async function deliverMissingIntakeEmails(
	client: Client,
	transport: EmailTransport,
	stored: StoredApiKeyRequest,
	mailbox: MailboxConfig,
): Promise<IntakeEmailAcceptance> {
	if (!stored.applicantEmailId) {
		const emailId = await sendWaitingListEmail(transport, stored.request, stored.id, mailbox);
		if (!await recordApplicantDelivery(client, stored.id, emailId)) {
			throw new Error("Applicant delivery persistence failed.");
		}
	}
	if (!stored.adminEmailId) {
		const emailId = await sendAdminNotificationEmail(transport, stored.request, stored.id, mailbox);
		if (!await recordAdminDelivery(client, stored.id, emailId)) {
			throw new Error("Administrator delivery persistence failed.");
		}
	}
	return { applicantEmailAccepted: true, adminEmailAccepted: true };
}

export async function handleApiKeyRequest(
	httpRequest: Request,
	client: Client,
	transport: EmailTransport,
	rateLimitSecret: string,
	clientIdentifier: string,
	requestId: string,
	nowMilliseconds: number,
	mailbox: MailboxConfig,
): Promise<Response> {
	const body = await readBoundedBody(httpRequest, MAXIMUM_BODY_BYTES);
	if (body === null) {
		return response("Check the form fields and try again.", 400, requestId);
	}

	const ipAllowed = await consumeRateLimit(
		client,
		"public-form-ip",
		identifierHash(clientIdentifier, rateLimitSecret),
		5,
		60 * 60 * 1_000,
		nowMilliseconds,
	);
	if (!ipAllowed) return response("Too many requests. Try again later.", 429, requestId);

	const request = parseApiKeyRequest(body);
	if (!request) return response("Check the form fields and try again.", 400, requestId);
	if (request.honeypotTriggered) return response(SUCCESS_MESSAGE, 201, requestId);

	const emailAllowed = await consumeRateLimit(
		client,
		"public-form-email",
		identifierHash(request.email.toLowerCase(), rateLimitSecret),
		3,
		24 * 60 * 60 * 1_000,
		nowMilliseconds,
	);
	if (!emailAllowed) return response("Too many requests. Try again later.", 429, requestId);

	try {
		let stored = await findStoredRequest(client, request.email);
		if (!stored) {
			await createPendingRequest(client, request, requestId, new Date(nowMilliseconds).toISOString());
			stored = await findStoredRequest(client, request.email);
		}
		if (!stored) throw new Error("Request persistence failed.");
		if (stored.status !== REQUEST_STATUS.PENDING
			|| stored.applicantEmailId && stored.adminEmailId) {
			return response(DUPLICATE_MESSAGE, 409, requestId);
		}

		await deliverMissingIntakeEmails(client, transport, stored, mailbox);
		return response(SUCCESS_MESSAGE, 201, requestId);
	} catch {
		return response("Your request could not be submitted. Try again shortly.", 503, requestId);
	}
}
