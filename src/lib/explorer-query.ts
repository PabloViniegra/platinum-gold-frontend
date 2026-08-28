import { buildItemsSearchParams, ItemsQueryError } from "./items-query";

export function buildExplorerSearchParams(
	search: string,
	quality: string,
	type: string,
	sort: string,
	order: string,
	limit: number,
	page: number,
): URLSearchParams {
	const input = new URLSearchParams();
	if (search) input.set("search", search);
	if (quality) input.set("quality", quality);
	if (type) input.set("type", type);
	input.set("sort", sort);
	input.set("order", order);
	input.set("limit", String(limit));
	input.set("offset", String(Math.max(0, page) * limit));
	return buildItemsSearchParams(input);
}

export function requestPath(
	search: string,
	quality: string,
	type: string,
	sort: string,
	order: string,
	limit: number,
	page: number,
): string {
	return `/api/items?${buildExplorerSearchParams(search, quality, type, sort, order, limit, page)}`;
}

export function contractRequestLine(
	search: string,
	quality: string,
	type: string,
	sort: string,
	order: string,
	limit: number,
	page: number,
): string {
	return `GET /v1/items?${buildExplorerSearchParams(search, quality, type, sort, order, limit, page)}`;
}

export function clampExplorerPage(raw: string, pageCount: number): number | null {
	if (!/^\d+$/.test(raw)) {
		return null;
	}
	const next = Number(raw);
	return Math.min(pageCount, Math.max(1, next)) - 1;
}

export function readExplorerSearch(input: URLSearchParams): URLSearchParams {
	try {
		return buildItemsSearchParams(input);
	} catch (error) {
		if (error instanceof ItemsQueryError) {
			return buildItemsSearchParams(new URLSearchParams());
		}
		throw error;
	}
}

export function explorerPage(params: URLSearchParams): number {
	const limit = Number(params.get("limit") ?? "12");
	const offset = Number(params.get("offset") ?? "0");
	return Math.floor(offset / limit);
}
