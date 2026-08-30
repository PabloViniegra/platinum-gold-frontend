import { readBoundedBody } from "./http-body";

export const COUNTRIES_URL = "https://date.nager.at/api/v3/AvailableCountries";

export const FALLBACK_COUNTRY_NAMES = [
	"Albania", "Algeria", "Andorra", "Angola", "Anguilla", "Antigua and Barbuda",
	"Argentina", "Armenia", "Aruba", "Australia", "Austria", "Åland Islands",
	"Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize",
	"Benin", "Bermuda", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana",
	"Brazil", "British Virgin Islands", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
	"Cambodia", "Cameroon", "Canada", "Cape Verde", "Caribbean Netherlands",
	"Cayman Islands", "Central African Republic", "Chad", "Chile", "China",
	"Christmas Island", "Cocos (Keeling) Islands", "Colombia", "Comoros", "Congo",
	"Cook Islands", "Costa Rica", "Croatia", "Cuba", "Curaçao", "Cyprus", "Czechia",
	"Denmark", "Djibouti", "Dominica", "Dominican Republic", "DR Congo", "Ecuador",
	"Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini",
	"Ethiopia", "Falkland Islands", "Faroe Islands", "Fiji", "Finland", "France",
	"French Guiana", "French Polynesia", "Gabon", "Gambia", "Georgia", "Germany",
	"Ghana", "Gibraltar", "Greece", "Greenland", "Grenada", "Guadeloupe", "Guatemala",
	"Guernsey", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hong Kong",
	"Hungary", "Iceland", "India", "Indonesia", "Iraq", "Ireland", "Isle of Man",
	"Israel", "Italy", "Ivory Coast", "Jamaica", "Japan", "Jersey", "Jordan",
	"Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos", "Latvia",
	"Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania",
	"Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta",
	"Marshall Islands", "Martinique", "Mauritania", "Mauritius", "Mayotte", "Mexico",
	"Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Montserrat",
	"Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
	"New Caledonia", "New Zealand", "Nicaragua", "Niger", "Nigeria", "Niue",
	"Norfolk Island", "North Korea", "North Macedonia", "Northern Mariana Islands",
	"Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
	"Paraguay", "Peru", "Philippines", "Pitcairn Islands", "Poland", "Portugal",
	"Puerto Rico", "Qatar", "Romania", "Russia", "Rwanda", "Saint Barthélemy",
	"Saint Helena, Ascension and Tristan da Cunha", "Saint Kitts and Nevis", "Saint Lucia",
	"Saint Martin", "Saint Pierre and Miquelon", "Saint Vincent and the Grenadines", "Samoa",
	"San Marino", "São Tomé and Príncipe", "Saudi Arabia", "Senegal", "Serbia",
	"Seychelles", "Sierra Leone", "Singapore", "Sint Maarten", "Slovakia", "Slovenia",
	"Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain",
	"Sri Lanka", "Sudan", "Suriname", "Svalbard and Jan Mayen", "Sweden", "Switzerland",
	"Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo",
	"Tokelau", "Tonga", "Trinidad and Tobago", "Tunisia", "Türkiye",
	"Turks and Caicos Islands", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
	"United Kingdom", "United States", "United States Virgin Islands", "Uruguay",
	"Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Wallis and Futuna",
	"Western Sahara", "Yemen", "Zambia", "Zimbabwe",
] as const;

type CountryCache = {
	names: string[];
	expiresAt: number;
};

const COUNTRY_CACHE_MILLISECONDS = 24 * 60 * 60 * 1_000;
const MAXIMUM_COUNTRY_BODY_BYTES = 65_536;
const COUNTRY_NAME_SET = new Set<string>(FALLBACK_COUNTRY_NAMES);
let countryCache: CountryCache | null = null;

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
	if (countryCache && countryCache.expiresAt > Date.now()) return [...countryCache.names];
	let names: string[];
	try {
		const response = await fetch(COUNTRIES_URL, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8_000),
		});
		const body = response.ok ? await readBoundedBody(response, MAXIMUM_COUNTRY_BODY_BYTES) : null;
		const remoteNames = body === null
			? null
			: parseCountryNames(body)?.filter((name) => COUNTRY_NAME_SET.has(name));
		names = remoteNames && remoteNames.length > 0 ? remoteNames : [...FALLBACK_COUNTRY_NAMES];
	} catch {
		names = [...FALLBACK_COUNTRY_NAMES];
	}
	countryCache = { names, expiresAt: Date.now() + COUNTRY_CACHE_MILLISECONDS };
	return [...names];
}
