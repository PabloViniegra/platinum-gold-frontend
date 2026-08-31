import type { APIRoute } from "astro";
import {
	REQUESTS_ADMIN_EMAIL,
	REQUESTS_ADMIN_USERNAME,
	REQUESTS_FROM_ADDRESS,
	REQUESTS_SESSION_SECRET,
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
	RESEND_API_KEY,
} from "astro:env/server";

import { handleRequestApproval } from "../../../../../lib/api-key-requests/approval";
import { adminJsonResponse } from "../../../../../lib/api-key-requests/admin-response";
import { getRequestsDatabase } from "../../../../../lib/api-key-requests/database";
import { createEmailTransport, parseMailboxConfig } from "../../../../../lib/api-key-requests/email";

export const prerender = false;

export const POST: APIRoute = async ({ request, params }) => {
	const mailbox = REQUESTS_FROM_ADDRESS && REQUESTS_ADMIN_EMAIL
		? parseMailboxConfig(REQUESTS_FROM_ADDRESS, REQUESTS_ADMIN_EMAIL)
		: null;
	if (!REQUESTS_ADMIN_USERNAME || !REQUESTS_SESSION_SECRET || !REQUESTS_TURSO_DB
		|| !REQUESTS_TURSO_TOKEN || !RESEND_API_KEY || !mailbox) {
		return adminJsonResponse("Administration is not configured.", 503);
	}
	try {
		const client = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
		return await handleRequestApproval(
			request,
			client,
			createEmailTransport(RESEND_API_KEY, params.id ?? crypto.randomUUID()),
			REQUESTS_ADMIN_USERNAME,
			REQUESTS_SESSION_SECRET,
			params.id,
			Date.now(),
			mailbox,
		);
	} catch {
		return adminJsonResponse("Approval could not be completed. Try again.", 503);
	}
};
