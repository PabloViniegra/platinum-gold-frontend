import { describe, expect, it } from "vitest";

import { API_KEY_USE_CASE, normalizeEmail, parseApiKeyRequest } from "./contracts";

function validBody(): string {
	return JSON.stringify({
		firstName: "  Isaac  ",
		lastName: "Moriah",
		email: "  Isaac@Example.com ",
		country: "Spain",
		occupation: "Frontend developer",
		useCase: API_KEY_USE_CASE.PERSONAL_PROJECT,
		website: "",
	});
}

describe("parseApiKeyRequest", () => {
	it("accepts and trims the documented request fields", () => {
		expect(parseApiKeyRequest(validBody())).toEqual({
			firstName: "Isaac",
			lastName: "Moriah",
			email: "Isaac@Example.com",
			country: "Spain",
			occupation: "Frontend developer",
			useCase: API_KEY_USE_CASE.PERSONAL_PROJECT,
			useCaseDetails: null,
			honeypotTriggered: false,
		});
	});

	it("requires details when the selected use case is other", () => {
		const body = JSON.stringify({
			...JSON.parse(validBody()),
			useCase: API_KEY_USE_CASE.OTHER,
		});

		expect(parseApiKeyRequest(body)).toBeNull();
	});

	it("marks a filled honeypot without rejecting an otherwise valid request", () => {
		const body = JSON.stringify({ ...JSON.parse(validBody()), website: "https://spam.example" });

		expect(parseApiKeyRequest(body)?.honeypotTriggered).toBe(true);
	});

	it.each([
		"not json",
		JSON.stringify({ ...JSON.parse(validBody()), email: "not-an-email" }),
		JSON.stringify({ ...JSON.parse(validBody()), firstName: "x".repeat(81) }),
		JSON.stringify({ ...JSON.parse(validBody()), country: "x".repeat(101) }),
		JSON.stringify({ ...JSON.parse(validBody()), useCase: "gaming" }),
		JSON.stringify({ ...JSON.parse(validBody()), occupation: "Supreme overlord" }),
		JSON.stringify({ ...JSON.parse(validBody()), country: "Nowhere" }),
		JSON.stringify({ ...JSON.parse(validBody()), unexpected: true }),
	])("rejects malformed, oversized, or unexpected input", (body) => {
		expect(parseApiKeyRequest(body)).toBeNull();
	});
});

describe("normalizeEmail", () => {
	it("normalizes case and surrounding whitespace for uniqueness", () => {
		expect(normalizeEmail("  Isaac@Example.com ")).toBe("isaac@example.com");
	});
});
