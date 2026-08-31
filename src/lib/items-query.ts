const ITEM_TYPES = new Set(["active", "passive", "familiar"]);
const SORT_FIELDS = new Set(["name", "quality", "game_id"]);
const SORT_ORDERS = new Set(["asc", "desc"]);

export class ItemsQueryError extends Error {}

function appendText(
	output: URLSearchParams,
	input: URLSearchParams,
	name: "search" | "version",
	maxLength: number,
): void {
	const value = input.get(name)?.trim();
	if (!value) {
		return;
	}
	if (value.length > maxLength) {
		throw new ItemsQueryError(`Invalid ${name}`);
	}
	output.set(name, value);
}

function readInteger(input: URLSearchParams, name: "limit" | "offset", fallback: number): number {
	const value = input.get(name);
	if (value === null) {
		return fallback;
	}
	if (!/^\d+$/.test(value)) {
		throw new ItemsQueryError(`Invalid ${name}`);
	}
	return Number(value);
}

export function buildItemsSearchParams(input: URLSearchParams): URLSearchParams {
	const output = new URLSearchParams();
	appendText(output, input, "search", 100);
	appendText(output, input, "version", 50);

	const quality = input.get("quality");
	if (quality !== null) {
		if (!/^[0-4]$/.test(quality)) {
			throw new ItemsQueryError("Invalid quality");
		}
		output.set("quality", quality);
	}

	const type = input.get("type");
	if (type !== null) {
		if (!ITEM_TYPES.has(type)) {
			throw new ItemsQueryError("Invalid type");
		}
		output.set("type", type);
	}

	const sort = input.get("sort") ?? "name";
	if (!SORT_FIELDS.has(sort)) {
		throw new ItemsQueryError("Invalid sort");
	}
	output.set("sort", sort);

	const order = input.get("order") ?? "asc";
	if (!SORT_ORDERS.has(order)) {
		throw new ItemsQueryError("Invalid order");
	}
	output.set("order", order);

	const limit = readInteger(input, "limit", 12);
	if (limit < 1 || limit > 24) {
		throw new ItemsQueryError("Invalid limit");
	}
	output.set("limit", String(limit));

	const offset = readInteger(input, "offset", 0);
	if (offset > 10_000) {
		throw new ItemsQueryError("Invalid offset");
	}
	output.set("offset", String(offset));

	return output;
}
