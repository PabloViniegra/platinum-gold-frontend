import type { APIRoute } from "astro";
import { PLATINUM_BACKEND_API_KEY } from "astro:env/server";

import { parseItemPage } from "../../lib/item-page";
import { buildItemsSearchParams, ItemsQueryError } from "../../lib/items-query";
import { proxyErrorMessage, proxyStatusForUpstream } from "../../lib/proxy-error";

export const prerender = false;

const API_ITEMS_URL = "https://tboi-api.pabloviniegra.dev/v1/items";

function errorResponse(message: string, status: number, requestId: string): Response {
	return Response.json(
		{ error: { message } },
		{
			status,
			headers: {
				"Cache-Control": "no-store",
				"X-Request-ID": requestId,
			},
		},
	);
}

export const GET: APIRoute = async ({ request }) => {
	const requestId = crypto.randomUUID();
	if (!PLATINUM_BACKEND_API_KEY) {
		console.error("PLATINUM_BACKEND_API_KEY is not configured", { requestId });
		return errorResponse("The item example is not configured yet.", 503, requestId);
	}

	let searchParams: URLSearchParams;
	try {
		searchParams = buildItemsSearchParams(new URL(request.url).searchParams);
	} catch (error) {
		if (error instanceof ItemsQueryError) {
			return errorResponse("Check the selected filters and try again.", 400, requestId);
		}
		throw error;
	}

	try {
		const upstream = await fetch(`${API_ITEMS_URL}?${searchParams}`, {
			headers: {
				Accept: "application/json",
				"X-API-Key": PLATINUM_BACKEND_API_KEY,
				"X-Request-ID": requestId,
			},
			signal: AbortSignal.timeout(8_000),
		});
		const responseRequestId = upstream.headers.get("X-Request-ID") ?? requestId;
		const body = await upstream.text();

		if (!upstream.ok) {
			console.error("Platinum Gold item request failed", {
				status: upstream.status,
				requestId: responseRequestId,
				body,
			});
			const status = proxyStatusForUpstream(upstream.status);
			return errorResponse(proxyErrorMessage("", status), status, responseRequestId);
		}
		const itemPage = parseItemPage(body);
		if (!itemPage) {
			console.error("Platinum Gold returned an invalid item response", {
				requestId: responseRequestId,
			});
			return errorResponse("Items could not be loaded. Try again shortly.", 502, responseRequestId);
		}

		return Response.json(itemPage, {
			headers: {
				"Cache-Control": "public, s-maxage=900, stale-while-revalidate=60",
				"Content-Type": "application/json; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
				"X-Request-ID": responseRequestId,
			},
		});
	} catch (error) {
		console.error("Platinum Gold item request did not complete", { requestId, error });
		return errorResponse("Items could not be loaded. Try again shortly.", 504, requestId);
	}
};
