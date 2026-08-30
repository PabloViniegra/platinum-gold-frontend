import type { Client } from "@libsql/client";

import {
	ADMIN_SESSION_COOKIE,
	createAdminSession,
	identifierHash,
	requestHasSameOrigin,
	verifyAdminPassword,
} from "./auth";
import { consumeRateLimit } from "./repository";

export type AdminLoginConfig = {
	username: string;
	passwordHash: string;
	sessionSecret: string;
};

type LoginPayload = {
	username: string;
	password: string;
};

function jsonResponse(message: string, status: number): Response {
	return Response.json({ message }, {
		status,
		headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
	});
}

function parseLogin(body: string): LoginPayload | null {
	try {
		const payload: LoginPayload = JSON.parse(body);
		if (payload === null
			|| payload.constructor !== Object
			|| payload.username?.constructor !== String
			|| payload.password?.constructor !== String
			|| payload.username.length > 100
			|| payload.password.length > 500) return null;
		return payload;
	} catch {
		return null;
	}
}

export async function handleAdminLogin(
	request: Request,
	client: Client,
	config: AdminLoginConfig,
	clientIdentifier: string,
	nowMilliseconds: number,
): Promise<Response> {
	if (!requestHasSameOrigin(request)) return jsonResponse("Request not allowed.", 403);
	const allowed = await consumeRateLimit(
		client,
		"admin-login",
		identifierHash(clientIdentifier, config.sessionSecret),
		5,
		15 * 60 * 1_000,
		nowMilliseconds,
	);
	if (!allowed) return jsonResponse("Too many attempts. Try again later.", 429);
	const payload = parseLogin(await request.text());
	if (!payload) return jsonResponse("Invalid credentials.", 401);
	const passwordMatches = verifyAdminPassword(payload.password, config.passwordHash);
	if (payload.username !== config.username || !passwordMatches) {
		return jsonResponse("Invalid credentials.", 401);
	}

	const token = createAdminSession(config.username, config.sessionSecret, nowMilliseconds);
	return new Response(null, {
		status: 204,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": sessionCookie(token, 28_800, request),
			"X-Content-Type-Options": "nosniff",
		},
	});
}

function sessionCookie(token: string, maxAge: number, request: Request): string {
	const parts = [
		`${ADMIN_SESSION_COOKIE}=${token}`,
		"Path=/",
		`Max-Age=${maxAge}`,
		"HttpOnly",
		"SameSite=Strict",
	];
	if (new URL(request.url).protocol === "https:") parts.push("Secure");
	return parts.join("; ");
}

export function handleAdminLogout(request: Request): Response {
	if (!requestHasSameOrigin(request)) return jsonResponse("Request not allowed.", 403);
	return new Response(null, {
		status: 204,
		headers: {
			"Cache-Control": "no-store",
			"Set-Cookie": sessionCookie("", 0, request),
			"X-Content-Type-Options": "nosniff",
		},
	});
}
