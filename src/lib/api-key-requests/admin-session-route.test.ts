import type { Client } from "@libsql/client";
import { describe, expect, it } from "vitest";

import { handleAdminSessionPost, type AdminSessionRouteConfig } from "./admin-session-route";

const CONFIG: AdminSessionRouteConfig = {
	username: "admin",
	passwordHash: "scrypt:salt:hash",
	sessionSecret: "a-session-secret-that-is-longer-than-thirty-two-characters",
	databaseUrl: "libsql://database.example",
	databaseToken: "token",
};

describe("admin session route", () => {
	it("maps database initialization failures to a hardened 503 response", async () => {
		const response = await handleAdminSessionPost(
			new Request("https://example.com/api/admin/session", {
				method: "POST",
				headers: { Origin: "https://example.com" },
				body: "{}",
			}),
			"127.0.0.1",
			120_000,
			CONFIG,
			async (): Promise<Client> => {
				throw new Error("database unavailable");
			},
		);

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ message: "Administration is unavailable." });
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
		expect(response.headers.get("X-Frame-Options")).toBe("DENY");
	});
});
