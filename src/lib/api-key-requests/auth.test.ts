import { describe, expect, it } from "vitest";

import {
	createAdminSession,
	hashAdminPassword,
	parseAdminSession,
	verifyAdminPassword,
} from "./auth";

const NOW = Date.UTC(2026, 7, 30, 12);
const SESSION_SECRET = "a-session-secret-that-is-longer-than-thirty-two-characters";

describe("admin password verification", () => {
	it("accepts the password used to create a scrypt hash", () => {
		const storedHash = hashAdminPassword("correct horse battery staple", "fixed-test-salt");

		expect(verifyAdminPassword("correct horse battery staple", storedHash)).toBe(true);
		expect(verifyAdminPassword("wrong password", storedHash)).toBe(false);
	});

	it.each(["", "sha256:salt:hash", "scrypt:missing-hash"])(
		"rejects malformed stored hashes",
		(storedHash) => {
			expect(verifyAdminPassword("a password", storedHash)).toBe(false);
		},
	);
});

describe("admin sessions", () => {
	it("round-trips an unexpired signed session", () => {
		const token = createAdminSession("pablo", SESSION_SECRET, NOW);

		expect(parseAdminSession(token, SESSION_SECRET, NOW + 1_000)).toEqual({
			username: "pablo",
			expiresAt: NOW + 8 * 60 * 60 * 1_000,
		});
	});

	it("rejects expired and tampered sessions", () => {
		const token = createAdminSession("pablo", SESSION_SECRET, NOW);
		const tampered = `${token.slice(0, -1)}x`;

		expect(parseAdminSession(token, SESSION_SECRET, NOW + 8 * 60 * 60 * 1_000)).toBeNull();
		expect(parseAdminSession(tampered, SESSION_SECRET, NOW + 1_000)).toBeNull();
	});

	it("rejects sessions when the signing secret is too short", () => {
		expect(() => createAdminSession("pablo", "short", NOW)).toThrow("Session secret");
	});
});
