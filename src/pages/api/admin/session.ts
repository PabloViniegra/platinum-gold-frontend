import type { APIRoute } from "astro";
import {
	REQUESTS_ADMIN_PASSWORD_HASH,
	REQUESTS_ADMIN_USERNAME,
	REQUESTS_SESSION_SECRET,
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
} from "astro:env/server";

import { handleAdminLogout } from "../../../lib/api-key-requests/admin-session";
import { adminHeaders, adminJsonResponse } from "../../../lib/api-key-requests/admin-response";
import { handleAdminSessionPost } from "../../../lib/api-key-requests/admin-session-route";
import { isAdminRequestAuthorized } from "../../../lib/api-key-requests/auth";
import { getRequestsDatabase } from "../../../lib/api-key-requests/database";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
	if (!REQUESTS_ADMIN_USERNAME || !REQUESTS_ADMIN_PASSWORD_HASH || !REQUESTS_SESSION_SECRET
		|| !REQUESTS_TURSO_DB || !REQUESTS_TURSO_TOKEN) {
		return adminJsonResponse("Administration is not configured.", 503);
	}
	return handleAdminSessionPost(request, clientAddress, Date.now(), {
		username: REQUESTS_ADMIN_USERNAME,
		passwordHash: REQUESTS_ADMIN_PASSWORD_HASH,
		sessionSecret: REQUESTS_SESSION_SECRET,
		databaseUrl: REQUESTS_TURSO_DB,
		databaseToken: REQUESTS_TURSO_TOKEN,
	}, getRequestsDatabase);
};

export const DELETE: APIRoute = ({ request }) => handleAdminLogout(request);

export const GET: APIRoute = ({ request }) => {
	const authenticated = Boolean(
		REQUESTS_ADMIN_USERNAME
		&& REQUESTS_SESSION_SECRET
		&& isAdminRequestAuthorized(request, REQUESTS_ADMIN_USERNAME, REQUESTS_SESSION_SECRET, Date.now()),
	);
	return Response.json({ authenticated }, {
		headers: adminHeaders(),
	});
};
