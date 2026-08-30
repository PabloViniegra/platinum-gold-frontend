import type { Client } from "@libsql/client";

import { adminEmptyResponse, adminJsonResponse } from "./admin-response";
import { isAdminRequestAuthorized, requestHasSameOrigin } from "./auth";
import { sendDenialEmail, type EmailTransport, type MailboxConfig } from "./email";
import { beginRequestDecision, markRequestDenied, releaseRequestDecision, REQUEST_STATUS } from "./repository";

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
	if (!requestHasSameOrigin(httpRequest)) return adminJsonResponse("Request not allowed.", 403);
	if (!isAdminRequestAuthorized(httpRequest, username, sessionSecret, nowMilliseconds)) {
		return adminJsonResponse("Authentication required.", 401);
	}
	if (!requestId || requestId.length > 100) {
		return adminJsonResponse("This request is no longer pending.", 409);
	}

	try {
		const owner = crypto.randomUUID();
		const pending = await beginRequestDecision(
			client, requestId, REQUEST_STATUS.DENYING, null, owner, nowMilliseconds,
		);
		if (!pending) return adminJsonResponse("This request is no longer pending.", 409);
		try {
			const emailId = await sendDenialEmail(
				transport,
				pending.email,
				pending.firstName,
				pending.id,
				mailbox,
			);
			if (!await markRequestDenied(client, pending.id, emailId, new Date(nowMilliseconds).toISOString())) {
				return adminJsonResponse("This request is no longer pending.", 409);
			}
		} catch {
			await releaseRequestDecision(client, requestId, REQUEST_STATUS.DENYING, owner);
			throw new Error("Denial delivery failed.");
		}
		return adminEmptyResponse(204);
	} catch {
		return adminJsonResponse("Denial could not be completed. Try again.", 503);
	}
}
