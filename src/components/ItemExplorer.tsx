import { keepPreviousData, QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useState } from "react";

import {
	buildExplorerSearchParams,
	clampExplorerPage,
	contractRequestLine,
	explorerPage,
	readExplorerSearch,
	requestPath,
} from "../lib/explorer-query";
import type { Item, ItemPage } from "../lib/item-page";
import "./item-explorer.css";

type Filters = {
	search: string;
	quality: string;
	type: string;
	sort: string;
	order: string;
	limit: number;
};

const EMPTY_FILTERS: Filters = {
	search: "",
	quality: "",
	type: "",
	sort: "name",
	order: "asc",
	limit: 12,
};

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			gcTime: 15 * 60 * 1_000,
			staleTime: 15 * 60 * 1_000,
			retry: 1,
		},
	},
});

function filtersFromParams(params: URLSearchParams): Filters {
	return {
		search: params.get("search") ?? "",
		quality: params.get("quality") ?? "",
		type: params.get("type") ?? "",
		sort: params.get("sort") ?? "name",
		order: params.get("order") ?? "asc",
		limit: Number(params.get("limit") ?? "12"),
	};
}

function initialParams(): URLSearchParams {
	return readExplorerSearch(new URLSearchParams(window.location.search));
}

async function fetchItems(
	search: string,
	quality: string,
	type: string,
	sort: string,
	order: string,
	limit: number,
	page: number,
	signal: AbortSignal,
): Promise<ItemPage> {
	const response = await fetch(
		requestPath(search, quality, type, sort, order, limit, page),
		{ signal },
	);
	if (!response.ok) {
		throw new ItemsRequestError(response.headers.get("X-Request-ID"));
	}
	return response.json();
}

class ItemsRequestError extends Error {
	readonly requestId: string | null;

	constructor(requestId: string | null) {
		super("Items could not be loaded.");
		this.requestId = requestId;
	}
}

function wireValue(value: string | number | null): string {
	return value === null ? "null" : String(value);
}

function ItemCard(item: Item) {
	return (
		<li className="item-card" data-quality={item.quality ?? "unset"}>
			<div className="item-image">
				<img src={item.imageUrl} alt={item.name} width="96" height="96" loading="lazy" decoding="async" />
			</div>
			<div className="item-card-body">
				<p className="item-card-name">{item.name}</p>
				<dl>
					<div>
						<dt>gameId</dt>
						<dd>{item.gameId}</dd>
					</div>
					<div>
						<dt>type</dt>
						<dd>{wireValue(item.type)}</dd>
					</div>
					<div>
						<dt>quality</dt>
						<dd>{wireValue(item.quality)}</dd>
					</div>
				</dl>
				<details className="item-card-more">
					<summary>More fields</summary>
					<dl>
						<div>
							<dt>rechargeTime</dt>
							<dd>{wireValue(item.rechargeTime)}</dd>
						</div>
						<div>
							<dt>introducedInVersion</dt>
							<dd>{wireValue(item.introducedInVersion)}</dd>
						</div>
					</dl>
					{item.description && <p className="item-card-lore">{item.description}</p>}
				</details>
			</div>
		</li>
	);
}

function ItemExplorerContent() {
	const startup = initialParams();
	const [draft, setDraft] = useState<Filters>(() => filtersFromParams(startup));
	const [filters, setFilters] = useState<Filters>(() => filtersFromParams(startup));
	const [page, setPage] = useState(() => explorerPage(startup));
	const [copyStatus, setCopyStatus] = useState("");
	const [pageInput, setPageInput] = useState(() => String(explorerPage(startup) + 1));
	const path = requestPath(
		filters.search,
		filters.quality,
		filters.type,
		filters.sort,
		filters.order,
		filters.limit,
		page,
	);
	const contractLine = contractRequestLine(
		filters.search,
		filters.quality,
		filters.type,
		filters.sort,
		filters.order,
		filters.limit,
		page,
	);
	const isDirty = draft.search.trim() !== filters.search
		|| draft.quality !== filters.quality
		|| draft.type !== filters.type
		|| draft.sort !== filters.sort
		|| draft.order !== filters.order
		|| draft.limit !== filters.limit;
	const query = useQuery({
		queryKey: ["items", filters.search, filters.quality, filters.type, filters.sort, filters.order, filters.limit, page],
		queryFn: (context) => fetchItems(
			filters.search,
			filters.quality,
			filters.type,
			filters.sort,
			filters.order,
			filters.limit,
			page,
			context.signal,
		),
		placeholderData: keepPreviousData,
	});

	useEffect(() => {
		const next = `?${buildExplorerSearchParams(
			filters.search,
			filters.quality,
			filters.type,
			filters.sort,
			filters.order,
			filters.limit,
			page,
		)}`;
		if (`${window.location.search}` !== next) {
			window.history.replaceState(null, "", next);
		}
	}, [filters, page]);

	useEffect(() => {
		if (!copyStatus) {
			return;
		}
		const timer = window.setTimeout(() => {
			setCopyStatus("");
		}, 2500);
		return () => window.clearTimeout(timer);
	}, [copyStatus]);

	function goToPage(next: number): void {
		setPage(next);
		setPageInput(String(next + 1));
	}

	function applyFilters(next: Filters, nextPage: number): void {
		setDraft(next);
		setFilters(next);
		setPage(nextPage);
		setPageInput(String(nextPage + 1));
		setCopyStatus("");
	}

	function submitFilters(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		applyFilters({ ...draft, search: draft.search.trim() }, 0);
	}

	function resetFilters(): void {
		applyFilters(EMPTY_FILTERS, 0);
	}

	async function copyRequest(): Promise<void> {
		try {
			await navigator.clipboard.writeText(contractLine);
			setCopyStatus("Copied GET /v1/items");
		} catch {
			setCopyStatus("Copy failed");
		}
	}

	const pageCount = query.data ? Math.max(1, Math.ceil(query.data.total / query.data.limit)) : 1;
	const firstResult = query.data && query.data.total > 0 ? query.data.offset + 1 : 0;
	const lastResult = query.data ? Math.min(query.data.offset + query.data.items.length, query.data.total) : 0;
	const activeQuery = path.replace("/api/items?", "");
	const resultSummary = query.isFetching && !query.isPending
		? "Updating from the network"
		: query.isError
			? "The list request failed"
			: query.data && query.data.total === 0
				? `No items for ${activeQuery}`
				: query.data
					? `${firstResult}–${lastResult} of ${query.data.total}`
					: "Loading GET /v1/items";

	function commitPageInput(raw: string): void {
		const next = clampExplorerPage(raw, pageCount);
		if (next === null) {
			setPageInput(String(page + 1));
			return;
		}
		goToPage(next);
	}

	return (
		<section className="item-explorer" aria-labelledby="item-explorer-title">
			<h2 id="item-explorer-title">Explore the response</h2>

			<div className="item-request">
				<p>
					<code>{contractLine}</code>
				</p>
				<button className="item-button-copy" type="button" onClick={() => void copyRequest()}>
					Copy /v1/items
				</button>
				<span className="item-copy-status" aria-live="polite">{copyStatus}</span>
			</div>
			<p className="item-request-hint">Fetched via /api/items so the key stays on the server.</p>

			<form className="item-filters" onSubmit={submitFilters}>
				<div className="item-filter-search">
					<label htmlFor="item-search">search</label>
					<input
						id="item-search"
						name="search"
						type="search"
						placeholder="Brimstone"
						maxLength={100}
						value={draft.search}
						onChange={(event) => setDraft({ ...draft, search: event.target.value })}
					/>
				</div>
				<div className="item-filter-actions">
					<button className="item-button-primary" type="submit">Apply query</button>
					<button className="item-button-secondary" type="button" onClick={resetFilters}>Reset</button>
					{isDirty && <p className="item-filter-dirty">Query changed. Apply to run it.</p>}
				</div>
				<details className="item-filter-more">
					<summary>type, quality, sort, order, limit</summary>
					<div>
						<label htmlFor="item-type">type</label>
						<select
							id="item-type"
							name="type"
							value={draft.type}
							onChange={(event) => setDraft({ ...draft, type: event.target.value })}
						>
							<option value="">Any</option>
							<option value="active">active</option>
							<option value="passive">passive</option>
							<option value="familiar">familiar</option>
						</select>
					</div>
					<div>
						<label htmlFor="item-quality">quality</label>
						<select
							id="item-quality"
							name="quality"
							value={draft.quality}
							onChange={(event) => setDraft({ ...draft, quality: event.target.value })}
						>
							<option value="">Any</option>
							{[0, 1, 2, 3, 4].map((quality) => (
								<option key={quality} value={quality}>{quality}</option>
							))}
						</select>
					</div>
					<div>
						<label htmlFor="item-sort">sort</label>
						<select
							id="item-sort"
							name="sort"
							value={draft.sort}
							onChange={(event) => setDraft({ ...draft, sort: event.target.value })}
						>
							<option value="name">name</option>
							<option value="quality">quality</option>
							<option value="gameId">gameId</option>
						</select>
					</div>
					<div>
						<label htmlFor="item-order">order</label>
						<select
							id="item-order"
							name="order"
							value={draft.order}
							onChange={(event) => setDraft({ ...draft, order: event.target.value })}
						>
							<option value="asc">asc</option>
							<option value="desc">desc</option>
						</select>
					</div>
					<div>
						<label htmlFor="item-limit">limit</label>
						<select
							id="item-limit"
							name="limit"
							value={draft.limit}
							onChange={(event) => setDraft({ ...draft, limit: Number(event.target.value) })}
						>
							<option value={12}>12</option>
							<option value={24}>24</option>
						</select>
					</div>
				</details>
			</form>

			<output className="item-results-bar" aria-live="polite">
				<p>{resultSummary}</p>
			</output>

			{query.isPending ? (
				<div className="item-loading">
					<ul className="item-grid" aria-hidden="true">
						{Array.from({ length: filters.limit }, (_, index) => (
							<li className="item-card item-card-skeleton" key={index}>
								<div className="item-image item-skeleton-block"></div>
								<div className="item-card-body">
									<div className="item-skeleton-line item-skeleton-title"></div>
									<div className="item-skeleton-line item-skeleton-short"></div>
									<div className="item-skeleton-line item-skeleton-medium"></div>
									<div className="item-skeleton-line"></div>
									<div className="item-skeleton-line item-skeleton-short"></div>
								</div>
							</li>
						))}
					</ul>
				</div>
			) : query.isError ? (
				<div className="item-state" role="alert">
					<p className="item-state-title">The list request failed</p>
					<p>Retry the same query. If it keeps failing, send the request ID with the support ticket.</p>
					{query.error instanceof ItemsRequestError && query.error.requestId && (
						<p className="item-request-id">Request ID: <code>{query.error.requestId}</code></p>
					)}
					<button className="item-button-primary" type="button" onClick={() => void query.refetch()}>
						Try again
					</button>
				</div>
			) : query.data.items.length === 0 ? (
				<div className="item-state">
					<p className="item-state-title">No items match this query</p>
					<p>Clear filters or change <code>{activeQuery}</code>.</p>
					<button className="item-button-secondary" type="button" onClick={resetFilters}>
						Clear filters
					</button>
				</div>
			) : (
				<ul className="item-grid" role="list" aria-busy={query.isFetching}>
					{query.data.items.map((item) => <ItemCard {...item} key={item.gameId} />)}
				</ul>
			)}

			{query.data && query.data.items.length > 0 && (
				<details className="item-json">
					<summary>Response JSON</summary>
					<pre><code>{JSON.stringify(query.data, null, 2)}</code></pre>
				</details>
			)}

			{query.data && query.data.total > 0 && pageCount > 1 && (
				<nav className="item-pagination" aria-label="Item results pages">
					<button
						className="item-button-secondary"
						type="button"
						disabled={page === 0 || query.isPlaceholderData || isDirty}
						onClick={() => goToPage(Math.max(0, page - 1))}
					>
						Previous
					</button>
					<label className="item-page-jump">
						Page
						<input
							type="number"
							min={1}
							max={pageCount}
							value={pageInput}
							disabled={query.isPlaceholderData || isDirty}
							onChange={(event) => setPageInput(event.target.value)}
							onBlur={(event) => commitPageInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									commitPageInput(event.currentTarget.value);
								}
							}}
						/>
						of {pageCount}
					</label>
					<button
						className="item-button-secondary"
						type="button"
						disabled={page + 1 >= pageCount || query.isPlaceholderData || isDirty}
						onClick={() => goToPage(page + 1)}
					>
						Next
					</button>
				</nav>
			)}
		</section>
	);
}

export default function ItemExplorer() {
	return (
		<QueryClientProvider client={queryClient}>
			<ItemExplorerContent />
		</QueryClientProvider>
	);
}
