import type { Client } from "@libsql/client";

import { isAdminRequestAuthorized, requestHasSameOrigin } from "./auth";
import { sendDenialEmail, type EmailTransport, type MailboxConfig } from "./email";
import { findPendingRequestById, markRequestDenied } from "./repository";

function jsonResponse(message: string, status: number): Response {
	return Response.json({ message }, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

export async function handleRequestDenial(
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
	if (!requestId || requestId.length > 100) {
		return jsonResponse("This request is no longer pending.", 409);
	}

	try {
		const pending = await findPendingRequestById(client, requestId);
		if (!pending) return jsonResponse("This request is no longer pending.", 409);
		const emailId = await sendDenialEmail(
			transport,
			pending.email,
			pending.firstName,
			pending.id,
			mailbox,
		);
		if (!await markRequestDenied(client, pending.id, emailId, new Date(nowMilliseconds).toISOString())) {
			return jsonResponse("This request is no longer pending.", 409);
		}
		return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
	} catch {
		return jsonResponse("Denial could not be completed. Try again.", 503);
	}
}
