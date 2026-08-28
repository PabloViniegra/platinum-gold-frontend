import { describe, expect, it } from "vitest";

import {
	isRetryableProxyStatus,
	proxyErrorMessage,
	proxyStatusForUpstream,
} from "./proxy-error";

describe("proxyErrorMessage", () => {
	it("prefers the proxy error message when the body matches the contract", () => {
		expect(
			proxyErrorMessage(
				JSON.stringify({ error: { message: "The item example is not configured yet." } }),
				503,
			),
		).toBe("The item example is not configured yet.");
	});

	it("falls back from status when the body is not a proxy error", () => {
		expect(proxyErrorMessage("not json", 503)).toBe("The item example is not configured yet.");
		expect(proxyErrorMessage("{}", 400)).toBe("Check the selected filters and try again.");
		expect(proxyErrorMessage("", 502)).toBe("Items could not be loaded. Try again shortly.");
	});
});

describe("isRetryableProxyStatus", () => {
	it("treats only transient proxy failures as retryable", () => {
		expect(isRetryableProxyStatus(502)).toBe(true);
		expect(isRetryableProxyStatus(504)).toBe(true);
		expect(isRetryableProxyStatus(400)).toBe(false);
		expect(isRetryableProxyStatus(503)).toBe(false);
	});
});

describe("proxyStatusForUpstream", () => {
	it("maps missing or forbidden keys to the unconfigured example", () => {
		expect(proxyStatusForUpstream(401)).toBe(503);
		expect(proxyStatusForUpstream(403)).toBe(503);
	});

	it("maps other upstream failures to a retryable bad gateway", () => {
		expect(proxyStatusForUpstream(422)).toBe(502);
		expect(proxyStatusForUpstream(500)).toBe(502);
		expect(proxyStatusForUpstream(429)).toBe(502);
	});
});
