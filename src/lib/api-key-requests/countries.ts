export const COUNTRIES_URL = "https://date.nager.at/api/v3/AvailableCountries";

export const FALLBACK_COUNTRY_NAMES = [
	"Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "Chile",
	"China", "Colombia", "Czechia", "Denmark", "Egypt", "Finland", "France",
	"Germany", "Greece", "Hungary", "India", "Indonesia", "Ireland", "Israel",
	"Italy", "Japan", "Kenya", "Malaysia", "Mexico", "Netherlands", "New Zealand",
	"Nigeria", "Norway", "Pakistan", "Peru", "Philippines", "Poland", "Portugal",
	"Romania", "Saudi Arabia", "Singapore", "South Africa", "South Korea", "Spain",
	"Sweden", "Switzerland", "Thailand", "Turkey", "Ukraine", "United Arab Emirates",
	"United Kingdom", "United States", "Vietnam",
] as const;

type CountryRecord = {
	name: string;
};

export function parseCountryNames(body: string): string[] | null {
	try {
		const rows: CountryRecord[] = JSON.parse(body);
		if (!Array.isArray(rows)) return null;
		const names = rows
			.map((row) => row.name)
			.filter((name) => name?.constructor === String && name.trim().length > 0)
			.map((name) => name.trim());
		if (names.length === 0) return null;
		return [...new Set(names)].sort((left, right) => left.localeCompare(right, "en"));
	} catch {
		return null;
	}
}

export async function loadCountryNames(): Promise<string[]> {
	try {
		const response = await fetch(COUNTRIES_URL, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8_000),
		});
		if (!response.ok) return [...FALLBACK_COUNTRY_NAMES];
		return parseCountryNames(await response.text()) ?? [...FALLBACK_COUNTRY_NAMES];
	} catch {
		return [...FALLBACK_COUNTRY_NAMES];
	}
}
