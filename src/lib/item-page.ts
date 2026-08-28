export type Item = {
	gameId: number;
	name: string;
	description: string;
	quality: number | null;
	type: string | null;
	rechargeTime: string | null;
	imageUrl: string;
	introducedInVersion: string | null;
};

export type ItemPage = {
	items: Item[];
	total: number;
	limit: number;
	offset: number;
};

function isString(value: string): boolean {
	return value?.constructor === String;
}

function isNullableString(value: string | null): boolean {
	return value === null || isString(value);
}

function isHttpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === "https:";
	} catch {
		return false;
	}
}

function isItem(item: Item): boolean {
	return item !== null
		&& Number.isInteger(item.gameId)
		&& isString(item.name)
		&& isString(item.description)
		&& (item.quality === null || Number.isInteger(item.quality) && item.quality >= 0 && item.quality <= 4)
		&& isNullableString(item.type)
		&& isNullableString(item.rechargeTime)
		&& isString(item.imageUrl)
		&& isHttpsUrl(item.imageUrl)
		&& isNullableString(item.introducedInVersion);
}

export function parseItemPage(body: string): ItemPage | null {
	try {
		const page: ItemPage = JSON.parse(body);
		if (page === null
			|| !Array.isArray(page.items)
			|| !page.items.every(isItem)
			|| !Number.isInteger(page.total)
			|| !Number.isInteger(page.limit)
			|| !Number.isInteger(page.offset)
			|| page.total < 0
			|| page.limit < 1
			|| page.offset < 0) {
			return null;
		}
		return page;
	} catch {
		return null;
	}
}
