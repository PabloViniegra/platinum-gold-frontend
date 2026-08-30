import type { APIRoute } from "astro";
import {
	REQUESTS_ADMIN_USERNAME,
	REQUESTS_SESSION_SECRET,
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
} from "astro:env/server";

import { isAdminRequestAuthorized } from "../../../../lib/api-key-requests/auth";
import { getRequestsDatabase } from "../../../../lib/api-key-requests/database";
import { listPendingRequests } from "../../../../lib/api-key-requests/repository";

export const prerender = false;

function errorResponse(message: string, status: number): Response {
	return Response.json({ message }, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

export const GET: APIRoute = async ({ request }) => {
	if (!REQUESTS_ADMIN_USERNAME || !REQUESTS_SESSION_SECRET
		|| !REQUESTS_TURSO_DB || !REQUESTS_TURSO_TOKEN) {
		return errorResponse("Administration is not configured.", 503);
	}
	if (!isAdminRequestAuthorized(request, REQUESTS_ADMIN_USERNAME, REQUESTS_SESSION_SECRET, Date.now())) {
		return errorResponse("Authentication required.", 401);
	}
	try {
		const client = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
		return Response.json({ requests: await listPendingRequests(client) }, {
			headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
		});
	} catch {
		return errorResponse("Requests could not be loaded.", 503);
	}
};
