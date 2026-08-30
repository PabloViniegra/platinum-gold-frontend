import { createClient, type Client } from "@libsql/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashAdminPassword, isAdminRequestAuthorized } from "./auth";
import { handleAdminLogin, handleAdminLogout, type AdminLoginConfig } from "./admin-session";
import { initializeRequestsSchema } from "./repository";

const NOW = 120_000;
const CONFIG: AdminLoginConfig = {
	username: "pablo",
	passwordHash: hashAdminPassword("correct horse battery staple", "fixed-test-salt"),
	sessionSecret: "a-session-secret-that-is-longer-than-thirty-two-characters",
};

function loginRequest(password: string, origin = "https://example.com"): Request {
	return new Request("https://example.com/api/admin/session", {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: origin },
		body: JSON.stringify({ username: "pablo", password }),
	});
}

describe("admin session service", () => {
	let client: Client;

	beforeEach(async () => {
		client = createClient({ url: "file::memory:" });
		await initializeRequestsSchema(client);
	});

	afterEach(() => client.close());

	it("creates an authorized secure session for valid credentials", async () => {
		const response = await handleAdminLogin(loginRequest("correct horse battery staple"), client, CONFIG, "ip-1", NOW);
		const cookie = response.headers.get("Set-Cookie") ?? "";

		expect(response.status).toBe(204);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Secure");
		expect(cookie).toContain("SameSite=Strict");
		const protectedRequest = new Request("https://example.com/api/admin/key-requests", {
			headers: { Cookie: cookie.split(";", 1)[0] ?? "" },
		});
		expect(isAdminRequestAuthorized(
			protectedRequest,
			CONFIG.username,
			CONFIG.sessionSecret,
			NOW + 1_000,
		)).toBe(true);
	});

	it("rejects invalid credentials and cross-origin attempts generically", async () => {
		const invalid = await handleAdminLogin(loginRequest("wrong password"), client, CONFIG, "ip-1", NOW);
		const crossOrigin = await handleAdminLogin(
			loginRequest("correct horse battery staple", "https://attacker.example"),
			client,
			CONFIG,
			"ip-2",
			NOW,
		);

		expect(invalid.status).toBe(401);
		expect(crossOrigin.status).toBe(403);
		expect(await invalid.json()).toEqual({ message: "Invalid credentials." });
	});

	it("omits Secure on http local login without an Origin header", async () => {
		const response = await handleAdminLogin(
			new Request("http://127.0.0.1:4321/api/admin/session", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Sec-Fetch-Site": "same-origin",
				},
				body: JSON.stringify({ username: "pablo", password: "correct horse battery staple" }),
			}),
			client,
			CONFIG,
			"ip-1",
			NOW,
		);
		const cookie = response.headers.get("Set-Cookie") ?? "";

		expect(response.status).toBe(204);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).not.toContain("Secure");
	});

	it("expires the admin cookie on same-origin logout", () => {
		const response = handleAdminLogout(new Request("https://example.com/api/admin/session", {
			method: "DELETE",
			headers: { Origin: "https://example.com" },
		}));

		expect(response.status).toBe(204);
		expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
	});
});
