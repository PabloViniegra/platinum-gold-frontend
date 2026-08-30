import { describe, expect, it } from "vitest";

import { parseCountryNames } from "./countries";

describe("parseCountryNames", () => {
	it("sorts unique country names from the Nager list contract", () => {
		const body = JSON.stringify([
			{ countryCode: "ES", name: "Spain" },
			{ countryCode: "US", name: "United States" },
			{ countryCode: "AD", name: "Andorra" },
			{ countryCode: "ES2", name: "Spain" },
		]);

		expect(parseCountryNames(body)).toEqual(["Andorra", "Spain", "United States"]);
	});

	it.each([
		"not json",
		JSON.stringify({ name: "Spain" }),
		JSON.stringify([{ countryCode: "ES" }]),
		JSON.stringify([]),
	])("rejects malformed country payloads", (body) => {
		expect(parseCountryNames(body)).toBeNull();
	});
});
