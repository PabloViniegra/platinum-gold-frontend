import { describe, expect, it } from "vitest";

import { parseItemPage } from "./item-page";

describe("parseItemPage", () => {
	it("accepts the documented item page contract", () => {
		const body = JSON.stringify({
			items: [{
				gameId: 118,
				name: "Brimstone",
				description: "Blood laser barrage",
				quality: 4,
				type: "passive",
				rechargeTime: null,
				imageUrl: "https://example.com/brimstone.png",
				introducedInVersion: "Rebirth",
			}],
			total: 1,
			limit: 12,
			offset: 0,
		});

		expect(parseItemPage(body)?.items[0]?.name).toBe("Brimstone");
	});

	it.each([
		"not json",
		JSON.stringify({ items: null, total: 1, limit: 12, offset: 0 }),
		JSON.stringify({ items: [{ gameId: "118", name: "Brimstone" }], total: 1, limit: 12, offset: 0 }),
	])("rejects malformed upstream responses", (body) => {
		expect(parseItemPage(body)).toBeNull();
	});
});
