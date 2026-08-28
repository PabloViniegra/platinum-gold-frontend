import { buildItemsSearchParams, ItemsQueryError } from "./items-query";

export type Filters = {
	search: string;
	quality: string;
	type: string;
	sort: string;
	order: string;
	limit: number;
};

export function buildExplorerSearchParams(filters: Filters, page: number): URLSearchParams {
	const input = new URLSearchParams();
	if (filters.search) input.set("search", filters.search);
	if (filters.quality) input.set("quality", filters.quality);
	if (filters.type) input.set("type", filters.type);
	input.set("sort", filters.sort);
	input.set("order", filters.order);
	input.set("limit", String(filters.limit));
	input.set("offset", String(Math.max(0, page) * filters.limit));
	return buildItemsSearchParams(input);
}

export function requestPath(filters: Filters, page: number): string {
	return `/api/items?${buildExplorerSearchParams(filters, page)}`;
}

export function contractRequestLine(filters: Filters, page: number): string {
	return `GET /v1/items?${buildExplorerSearchParams(filters, page)}`;
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

export function shouldKeepExplorerPlaceholder(
	previous: Filters,
	previousPage: number,
	next: Filters,
	nextPage: number,
): boolean {
	return previous.search === next.search
		&& previous.quality === next.quality
		&& previous.type === next.type
		&& previous.sort === next.sort
		&& previous.order === next.order
		&& previous.limit === next.limit
		&& previousPage !== nextPage;
}
