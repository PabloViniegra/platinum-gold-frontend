import type { Client } from "@libsql/client";

import { adminEmptyResponse, adminJsonResponse } from "./admin-response";
import { readBoundedBody } from "./http-body";
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

const MAXIMUM_LOGIN_BODY_BYTES = 2_048;

type LoginPayload = {
	username: string;
	password: string;
};

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
	if (!requestHasSameOrigin(request)) return adminJsonResponse("Request not allowed.", 403);
	const allowed = await consumeRateLimit(
		client,
		"admin-login",
		identifierHash(clientIdentifier, config.sessionSecret),
		5,
		15 * 60 * 1_000,
		nowMilliseconds,
	);
	if (!allowed) return adminJsonResponse("Too many attempts. Try again later.", 429);
	const body = await readBoundedBody(request, MAXIMUM_LOGIN_BODY_BYTES);
	const payload = body === null ? null : parseLogin(body);
	if (!payload) return adminJsonResponse("Invalid credentials.", 401);
	const passwordMatches = verifyAdminPassword(payload.password, config.passwordHash);
	if (payload.username !== config.username || !passwordMatches) {
		return adminJsonResponse("Invalid credentials.", 401);
	}

	const token = createAdminSession(config.username, config.sessionSecret, nowMilliseconds);
	return adminEmptyResponse(204, sessionCookie(token, 28_800, request));
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
	if (!requestHasSameOrigin(request)) return adminJsonResponse("Request not allowed.", 403);
	return adminEmptyResponse(204, sessionCookie("", 0, request));
}
