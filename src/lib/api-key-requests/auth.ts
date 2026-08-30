import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export type AdminSession = {
	username: string;
	expiresAt: number;
};

const SESSION_DURATION_MILLISECONDS = 8 * 60 * 60 * 1_000;
const MINIMUM_SESSION_SECRET_LENGTH = 32;
export const ADMIN_SESSION_COOKIE = "pg_requests_admin";

function assertSessionSecret(secret: string): void {
	if (secret.length < MINIMUM_SESSION_SECRET_LENGTH) {
		throw new Error("Session secret must contain at least 32 characters.");
	}
}

function sessionSignature(payload: string, secret: string): Buffer {
	return createHmac("sha256", secret).update(payload).digest();
}

export function identifierHash(value: string, secret: string): string {
	return createHmac("sha256", secret).update(value).digest("base64url");
}

export function requestHasSameOrigin(request: Request): boolean {
	const origin = request.headers.get("Origin");
	if (origin !== null) return origin === new URL(request.url).origin;
	return request.headers.get("Sec-Fetch-Site") === "same-origin";
}

export function sessionTokenFromRequest(request: Request): string | null {
	const cookie = request.headers.get("Cookie");
	if (!cookie) return null;
	for (const part of cookie.split(";")) {
		const [name, value] = part.trim().split("=", 2);
		if (name === ADMIN_SESSION_COOKIE && value) return value;
	}
	return null;
}

export function isAdminRequestAuthorized(
	request: Request,
	username: string,
	secret: string,
	nowMilliseconds: number,
): boolean {
	const token = sessionTokenFromRequest(request);
	if (!token) return false;
	return parseAdminSession(token, secret, nowMilliseconds)?.username === username;
}

export function hashAdminPassword(password: string, salt: string): string {
	const hash = scryptSync(password, salt, 64).toString("base64url");
	return `scrypt:${salt}:${hash}`;
}

export function verifyAdminPassword(password: string, storedHash: string): boolean {
	const parts = storedHash.split(":");
	if (parts.length !== 3 || parts[0] !== "scrypt" || !parts[1] || !parts[2]) return false;

	try {
		const expected = Buffer.from(parts[2], "base64url");
		const actual = scryptSync(password, parts[1], expected.length);
		return expected.length > 0 && timingSafeEqual(actual, expected);
	} catch {
		return false;
	}
}

export function createAdminSession(username: string, secret: string, nowMilliseconds: number): string {
	assertSessionSecret(secret);
	const session: AdminSession = {
		username,
		expiresAt: nowMilliseconds + SESSION_DURATION_MILLISECONDS,
	};
	const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
	const signature = sessionSignature(payload, secret).toString("base64url");
	return `${payload}.${signature}`;
}

export function parseAdminSession(
	token: string,
	secret: string,
	nowMilliseconds: number,
): AdminSession | null {
	if (secret.length < MINIMUM_SESSION_SECRET_LENGTH) return null;
	const parts = token.split(".");
	if (parts.length !== 2 || !parts[0] || !parts[1]) return null;

	try {
		const expected = sessionSignature(parts[0], secret);
		const actual = Buffer.from(parts[1], "base64url");
		if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

		const session: AdminSession = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
		if (session === null
			|| session.constructor !== Object
			|| session.username?.constructor !== String
			|| session.username.length === 0
			|| !Number.isSafeInteger(session.expiresAt)
			|| session.expiresAt <= nowMilliseconds) {
			return null;
		}
		return session;
	} catch {
		return null;
	}
}
