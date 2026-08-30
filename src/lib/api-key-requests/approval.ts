import type { Client } from "@libsql/client";

import { isAdminRequestAuthorized, requestHasSameOrigin } from "./auth";
import { sendApprovalEmail, type EmailTransport, type MailboxConfig } from "./email";
import { findPendingRequestById, markRequestApproved } from "./repository";

type ApprovalPayload = {
	apiKey: string;
	confirmation: string;
};

function jsonResponse(message: string, status: number): Response {
	return Response.json({ message }, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

function parseApproval(body: string): ApprovalPayload | null {
	try {
		const payload: ApprovalPayload = JSON.parse(body);
		if (payload === null || payload.constructor !== Object
			|| payload.apiKey?.constructor !== String || payload.confirmation?.constructor !== String) {
			return null;
		}
		const apiKey = payload.apiKey.trim();
		if (!apiKey || apiKey.length > 500 || apiKey !== payload.confirmation.trim()) return null;
		return { apiKey, confirmation: apiKey };
	} catch {
		return null;
	}
}

export async function handleRequestApproval(
	httpRequest: Request,
	client: Client,
	transport: EmailTransport,
	username: string,
	sessionSecret: string,
	requestId: string | undefined,
	nowMilliseconds: number,
	mailbox: MailboxConfig,
): Promise<Response> {
	if (!requestHasSameOrigin(httpRequest)) return jsonResponse("Request not allowed.", 403);
	if (!isAdminRequestAuthorized(httpRequest, username, sessionSecret, nowMilliseconds)) {
		return jsonResponse("Authentication required.", 401);
	}
	const payload = parseApproval(await httpRequest.text());
	if (!requestId || requestId.length > 100 || !payload) {
		return jsonResponse("Check the API key and try again.", 400);
	}

	try {
		const pending = await findPendingRequestById(client, requestId);
		if (!pending) return jsonResponse("This request is no longer pending.", 409);
		const emailId = await sendApprovalEmail(
			transport,
			pending.email,
			pending.firstName,
			payload.apiKey,
			pending.id,
			mailbox,
		);
		if (!await markRequestApproved(client, pending.id, emailId, new Date(nowMilliseconds).toISOString())) {
			return jsonResponse("This request is no longer pending.", 409);
		}
		return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
	} catch {
		return jsonResponse("Approval could not be completed. Try again.", 503);
	}
}
