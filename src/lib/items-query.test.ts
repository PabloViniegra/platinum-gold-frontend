import { describe, expect, it } from "vitest";

import { buildItemsSearchParams, ItemsQueryError } from "./items-query";

describe("buildItemsSearchParams", () => {
	it("forwards only normalized item-list parameters", () => {
		const input = new URLSearchParams({
			search: "  brimstone  ",
			quality: "4",
			type: "passive",
			version: "Repentance+",
			sort: "quality",
			order: "desc",
			limit: "12",
			offset: "24",
			redirect: "https://example.com",
		});

		const output = buildItemsSearchParams(input);

		expect(Object.fromEntries(output)).toEqual({
			search: "brimstone",
			quality: "4",
			type: "passive",
			version: "Repentance+",
			sort: "quality",
			order: "desc",
			limit: "12",
			offset: "24",
		});
		expect(output.has("redirect")).toBe(false);
	});

	it.each([
		["quality", "5"],
		["type", "trinket"],
		["sort", "description"],
		["order", "sideways"],
		["limit", "25"],
		["offset", "-1"],
	])("rejects invalid %s values", (name, value) => {
		const input = new URLSearchParams({ [name]: value });

		expect(() => buildItemsSearchParams(input)).toThrow(ItemsQueryError);
	});

	it("accepts the backend sort enum with snake_case game_id", () => {
		const output = buildItemsSearchParams(new URLSearchParams({ sort: "game_id" }));

		expect(output.get("sort")).toBe("game_id");
	});

	it("rejects camelCase gameId, which the live backend answers with 422", () => {
		expect(() => buildItemsSearchParams(new URLSearchParams({ sort: "gameId" }))).toThrow(
			ItemsQueryError,
		);
	});

	it("uses bounded pagination defaults", () => {
		expect(buildItemsSearchParams(new URLSearchParams()).toString()).toBe(
			"sort=name&order=asc&limit=12&offset=0",
		);
	});
});
