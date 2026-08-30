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

import { handleRequestDenial } from "../../../../../lib/api-key-requests/denial";
import { getRequestsDatabase } from "../../../../../lib/api-key-requests/database";
import { createEmailTransport } from "../../../../../lib/api-key-requests/email";

export const prerender = false;

function errorResponse(message: string, status: number): Response {
	return Response.json({ message }, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

export const POST: APIRoute = async ({ request, params }) => {
	if (!REQUESTS_ADMIN_USERNAME || !REQUESTS_SESSION_SECRET || !REQUESTS_TURSO_DB
		|| !REQUESTS_TURSO_TOKEN || !RESEND_API_KEY || !REQUESTS_FROM_ADDRESS || !REQUESTS_ADMIN_EMAIL) {
		return errorResponse("Administration is not configured.", 503);
	}
	try {
		const client = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
		return await handleRequestDenial(
			request,
			client,
			createEmailTransport(RESEND_API_KEY),
			REQUESTS_ADMIN_USERNAME,
			REQUESTS_SESSION_SECRET,
			params.id,
			Date.now(),
			{ fromAddress: REQUESTS_FROM_ADDRESS, adminAddress: REQUESTS_ADMIN_EMAIL },
		);
	} catch {
		return errorResponse("Denial could not be completed. Try again.", 503);
	}
};
