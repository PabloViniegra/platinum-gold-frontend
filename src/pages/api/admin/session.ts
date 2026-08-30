import type { APIRoute } from "astro";
import {
	REQUESTS_ADMIN_PASSWORD_HASH,
	REQUESTS_ADMIN_USERNAME,
	REQUESTS_SESSION_SECRET,
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
} from "astro:env/server";

import { handleAdminLogin, handleAdminLogout } from "../../../lib/api-key-requests/admin-session";
import { isAdminRequestAuthorized } from "../../../lib/api-key-requests/auth";
import { getRequestsDatabase } from "../../../lib/api-key-requests/database";

export const prerender = false;

function unavailable(): Response {
	return Response.json({ message: "Administration is not configured." }, {
		status: 503,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
	if (!REQUESTS_ADMIN_USERNAME || !REQUESTS_ADMIN_PASSWORD_HASH || !REQUESTS_SESSION_SECRET
		|| !REQUESTS_TURSO_DB || !REQUESTS_TURSO_TOKEN) return unavailable();
	const client = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
	return handleAdminLogin(request, client, {
		username: REQUESTS_ADMIN_USERNAME,
		passwordHash: REQUESTS_ADMIN_PASSWORD_HASH,
		sessionSecret: REQUESTS_SESSION_SECRET,
	}, clientAddress, Date.now());
};

export const DELETE: APIRoute = ({ request }) => handleAdminLogout(request);

export const GET: APIRoute = ({ request }) => {
	const authenticated = Boolean(
		REQUESTS_ADMIN_USERNAME
		&& REQUESTS_SESSION_SECRET
		&& isAdminRequestAuthorized(request, REQUESTS_ADMIN_USERNAME, REQUESTS_SESSION_SECRET, Date.now()),
	);
	return Response.json({ authenticated }, {
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
};
