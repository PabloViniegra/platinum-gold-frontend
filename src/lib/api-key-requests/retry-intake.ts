import type { Client } from "@libsql/client";

import { adminHeaders, adminJsonResponse } from "./admin-response";
import { isAdminRequestAuthorized, requestHasSameOrigin } from "./auth";
import type { EmailTransport, MailboxConfig } from "./email";
import {
	claimIntakeDelivery,
	findStoredRequestById,
	releaseIntakeDelivery,
	REQUEST_STATUS,
} from "./repository";
import { deliverMissingIntakeEmails } from "./service";

export async function handleIntakeRetry(
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
		const stored = await findStoredRequestById(client, requestId);
		if (!stored || stored.status !== REQUEST_STATUS.PENDING
			|| stored.applicantEmailId && stored.adminEmailId) {
			return adminJsonResponse("No intake email needs recovery.", 409);
		}
		const owner = crypto.randomUUID();
		if (!await claimIntakeDelivery(client, stored.id, owner, nowMilliseconds)) {
			return adminJsonResponse("This request is being updated. Try again.", 409);
		}
		try {
			const current = await findStoredRequestById(client, stored.id);
			if (!current || current.status !== REQUEST_STATUS.PENDING
				|| current.applicantEmailId && current.adminEmailId) {
				return adminJsonResponse("No intake email needs recovery.", 409);
			}
			const acceptance = await deliverMissingIntakeEmails(client, transport, current, mailbox);
			return Response.json(acceptance, { headers: adminHeaders() });
		} finally {
			await releaseIntakeDelivery(client, stored.id, owner);
		}
	} catch {
		return adminJsonResponse("Intake emails could not be recovered. Try again.", 503);
	}
}
