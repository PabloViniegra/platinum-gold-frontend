import { describe, expect, it } from "vitest";

import {
	buildExplorerSearchParams,
	clampExplorerPage,
	contractRequestLine,
	explorerPage,
	readExplorerSearch,
	requestPath,
} from "./explorer-query";

describe("buildExplorerSearchParams", () => {
	it("builds the documented list query from explorer state", () => {
		const output = buildExplorerSearchParams("Brimstone", "4", "passive", "quality", "desc", 12, 2);

		expect(Object.fromEntries(output)).toEqual({
			search: "Brimstone",
			quality: "4",
			type: "passive",
			sort: "quality",
			order: "desc",
			limit: "12",
			offset: "24",
		});
	});

	it("formats the proxy request path", () => {
		expect(requestPath("", "", "", "name", "asc", 12, 0)).toBe(
			"/api/items?sort=name&order=asc&limit=12&offset=0",
		);
	});

	it("formats the production GET line from the same query", () => {
		expect(contractRequestLine("", "", "", "name", "asc", 12, 0)).toBe(
			"GET /v1/items?sort=name&order=asc&limit=12&offset=0",
		);
	});
});

describe("clampExplorerPage", () => {
	it("commits a 1-based page inside the range", () => {
		expect(clampExplorerPage("3", 60)).toBe(2);
	});

	it("clamps to the last page", () => {
		expect(clampExplorerPage("99", 60)).toBe(59);
	});

	it("rejects non-integers", () => {
		expect(clampExplorerPage("", 60)).toBeNull();
		expect(clampExplorerPage("1.5", 60)).toBeNull();
	});
});

describe("readExplorerSearch", () => {
	it("recovers page from offset and limit", () => {
		const params = readExplorerSearch(new URLSearchParams("limit=24&offset=48"));

		expect(params.get("limit")).toBe("24");
		expect(explorerPage(params)).toBe(2);
	});

	it("falls back to defaults for invalid query strings", () => {
		const params = readExplorerSearch(new URLSearchParams("quality=9&limit=99"));

		expect(params.toString()).toBe("sort=name&order=asc&limit=12&offset=0");
	});
});
