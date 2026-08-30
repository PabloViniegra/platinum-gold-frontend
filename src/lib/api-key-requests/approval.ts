import type { Client } from "@libsql/client";

import { adminEmptyResponse, adminJsonResponse } from "./admin-response";
import { identifierHash, isAdminRequestAuthorized, requestHasSameOrigin } from "./auth";
import { sendApprovalEmail, type EmailTransport, type MailboxConfig } from "./email";
import { beginRequestDecision, markRequestApproved, releaseRequestDecision, REQUEST_STATUS } from "./repository";

type ApprovalPayload = {
	apiKey: string;
	confirmation: string;
};

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
	if (!requestHasSameOrigin(httpRequest)) return adminJsonResponse("Request not allowed.", 403);
	if (!isAdminRequestAuthorized(httpRequest, username, sessionSecret, nowMilliseconds)) {
		return adminJsonResponse("Authentication required.", 401);
	}
	const payload = parseApproval(await httpRequest.text());
	if (!requestId || requestId.length > 100 || !payload) {
		return adminJsonResponse("Check the API key and try again.", 400);
	}

	try {
		const owner = crypto.randomUUID();
		const pending = await beginRequestDecision(
			client,
			requestId,
			REQUEST_STATUS.APPROVING,
			identifierHash(payload.apiKey, sessionSecret),
			owner,
			nowMilliseconds,
		);
		if (!pending) return adminJsonResponse("This request is no longer pending.", 409);
		try {
			const emailId = await sendApprovalEmail(
				transport,
				pending.email,
				pending.firstName,
				payload.apiKey,
				pending.id,
				mailbox,
			);
			if (!await markRequestApproved(client, pending.id, emailId, new Date(nowMilliseconds).toISOString())) {
				return adminJsonResponse("This request is no longer pending.", 409);
			}
		} catch {
			await releaseRequestDecision(client, requestId, REQUEST_STATUS.APPROVING, owner);
			throw new Error("Approval delivery failed.");
		}
		return adminEmptyResponse(204);
	} catch {
		return adminJsonResponse("Approval could not be completed. Try again.", 503);
	}
}
