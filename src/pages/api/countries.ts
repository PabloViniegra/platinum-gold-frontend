import type { APIRoute } from "astro";

import { loadCountryNames } from "../../lib/api-key-requests/countries";

export const prerender = false;

export const GET: APIRoute = async () => {
	const countries = await loadCountryNames();
	return Response.json(
		{ countries },
		{
			headers: {
				"Cache-Control": "public, s-maxage=86400, stale-while-revalidate=3600",
				"X-Content-Type-Options": "nosniff",
			},
		},
	);
};
