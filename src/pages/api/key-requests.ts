import type { APIRoute } from "astro";
import {
	REQUESTS_ADMIN_EMAIL,
	REQUESTS_FROM_ADDRESS,
	REQUESTS_SESSION_SECRET,
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
	RESEND_API_KEY,
} from "astro:env/server";

import { getRequestsDatabase } from "../../lib/api-key-requests/database";
import { createEmailTransport } from "../../lib/api-key-requests/email";
import { handleApiKeyRequest } from "../../lib/api-key-requests/service";

export const prerender = false;

function unavailableResponse(requestId: string): Response {
	return Response.json(
		{ message: "API key requests are not configured yet." },
		{
			status: 503,
			headers: {
				"Cache-Control": "no-store",
				"X-Content-Type-Options": "nosniff",
				"X-Request-ID": requestId,
			},
		},
	);
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const requestId = crypto.randomUUID();
	if (!REQUESTS_TURSO_DB
		|| !REQUESTS_TURSO_TOKEN
		|| !RESEND_API_KEY
		|| !REQUESTS_FROM_ADDRESS
		|| !REQUESTS_ADMIN_EMAIL
		|| !REQUESTS_SESSION_SECRET
		|| REQUESTS_SESSION_SECRET.length < 32) {
		console.error("API key request service is not configured", { requestId });
		return unavailableResponse(requestId);
	}

	try {
		const requestsDatabase = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
		const transport = createEmailTransport(RESEND_API_KEY);
		return await handleApiKeyRequest(
			request,
			requestsDatabase,
			transport,
			REQUESTS_SESSION_SECRET,
			clientAddress,
			requestId,
			Date.now(),
			{ fromAddress: REQUESTS_FROM_ADDRESS, adminAddress: REQUESTS_ADMIN_EMAIL },
		);
	} catch {
		console.error("API key request did not complete", { requestId });
		return Response.json(
			{ message: "Your request could not be submitted. Try again shortly." },
			{
				status: 503,
				headers: {
					"Cache-Control": "no-store",
					"X-Content-Type-Options": "nosniff",
					"X-Request-ID": requestId,
				},
			},
		);
	}
};
