import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useCallback, useEffect, useRef, useState } from "react";

import {
	buildExplorerSearchParams,
	clampExplorerPage,
	contractRequestLine,
	explorerPage,
	readExplorerSearch,
	requestPath,
	shouldKeepExplorerPlaceholder,
	type Filters,
} from "../lib/explorer-query";
import type { Item, ItemPage } from "../lib/item-page";
import { isRetryableProxyStatus, proxyErrorMessage } from "../lib/proxy-error";
import "./item-explorer.css";

const EMPTY_FILTERS: Filters = {
	search: "",
	quality: "",
	type: "",
	sort: "name",
	order: "asc",
	limit: 12,
};

const LIMIT_CHOICES = [12, 24];
const SEARCH_DEBOUNCE_MS = 300;

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

async function fetchItems(filters: Filters, page: number, signal: AbortSignal): Promise<ItemPage> {
	const response = await fetch(requestPath(filters, page), { signal });
	if (!response.ok) {
		const body = await response.text();
		throw new ItemsRequestError(
			proxyErrorMessage(body, response.status),
			response.headers.get("X-Request-ID"),
			isRetryableProxyStatus(response.status),
		);
	}
	return response.json();
}

class ItemsRequestError extends Error {
	readonly requestId: string | null;
	readonly retryable: boolean;

	constructor(message: string, requestId: string | null, retryable: boolean) {
		super(message);
		this.requestId = requestId;
		this.retryable = retryable;
	}
}

const ITEM_FIELDS = [
	"gameId",
	"name",
	"type",
	"quality",
	"rechargeTime",
	"introducedInVersion",
	"imageUrl",
	"description",
] as const satisfies ReadonlyArray<keyof Item>;

function wireValue(value: string | number | null): string {
	return value === null ? "null" : String(value);
}

function bindDialogLightDismiss(dialog: HTMLDialogElement): () => void {
	if ("closedBy" in HTMLDialogElement.prototype) {
		return () => {};
	}

	function onBackdropClick(event: MouseEvent): void {
		if (event.target !== dialog) {
			return;
		}
		const rect = dialog.getBoundingClientRect();
		if (
			rect.top <= event.clientY
			&& event.clientY <= rect.top + rect.height
			&& rect.left <= event.clientX
			&& event.clientX <= rect.left + rect.width
		) {
			return;
		}
		dialog.close();
	}

	dialog.addEventListener("click", onBackdropClick);
	return () => dialog.removeEventListener("click", onBackdropClick);
}

function ItemCard(item: Item) {
	return (
		<>
			<span className="item-image">
				<img src={item.imageUrl} alt="" width={64} height={64} loading="lazy" decoding="async" />
			</span>
			<span className="item-card-name">{item.name}</span>
		</>
	);
}

function QualityPips(value: number) {
	return (
		<span className="item-quality-marks" aria-hidden="true">
			{Array.from({ length: 4 }, (_, pip) => (
				<span className={pip < value ? "is-on" : undefined} key={pip} />
			))}
		</span>
	);
}

function ItemDetail(item: Item) {
	return (
		<>
			<div className="item-detail-head">
				<div className="item-image">
					<img src={item.imageUrl} alt="" width={96} height={96} decoding="async" />
				</div>
				<h2 id="item-detail-title">{item.name}</h2>
				<form method="dialog">
					<button className="item-button-secondary" type="submit">Close</button>
				</form>
			</div>
			<dl id="item-detail-fields">
				{ITEM_FIELDS.map((key) => (
					<div data-field={key} key={key}>
						<dt>{key}</dt>
						<dd>
							{wireValue(item[key])}
							{key === "quality" && item.quality !== null && QualityPips(item.quality)}
						</dd>
					</div>
				))}
			</dl>
		</>
	);
}

function ItemExplorerContent() {
	const startup = initialParams();
	const [filters, setFilters] = useState<Filters>(() => filtersFromParams(startup));
	const [searchInput, setSearchInput] = useState(() => filtersFromParams(startup).search);
	const [page, setPage] = useState(() => explorerPage(startup));
	const [copyStatus, setCopyStatus] = useState("");
	const [pageInput, setPageInput] = useState(() => String(explorerPage(startup) + 1));
	const [selected, setSelected] = useState<Item | null>(null);
	const [jsonOpen, setJsonOpen] = useState(false);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const path = requestPath(filters, page);
	const contractLine = contractRequestLine(filters, page);

	const applyFilters = useCallback((next: Filters, nextPage: number): void => {
		setFilters(next);
		setPage(nextPage);
		setPageInput(String(nextPage + 1));
		setCopyStatus("");
		setSelected(null);
	}, []);

	const commitSearch = useCallback((raw: string): void => {
		applyFilters({ ...filters, search: raw.trim() }, 0);
	}, [applyFilters, filters]);

	const query = useQuery({
		queryKey: ["items", filters.search, filters.quality, filters.type, filters.sort, filters.order, filters.limit, page],
		queryFn: (context) => fetchItems(filters, page, context.signal),
		placeholderData: (previousData, previousQuery) => {
			if (!previousData || previousQuery === undefined) {
				return undefined;
			}
			const key = previousQuery.queryKey;
			const previous: Filters = {
				search: String(key[1] ?? ""),
				quality: String(key[2] ?? ""),
				type: String(key[3] ?? ""),
				sort: String(key[4] ?? ""),
				order: String(key[5] ?? ""),
				limit: Number(key[6]),
			};
			return shouldKeepExplorerPlaceholder(previous, Number(key[7]), filters, page)
				? previousData
				: undefined;
		},
	});

	useEffect(() => {
		if (searchInput.trim() === filters.search) {
			return;
		}
		const timer = window.setTimeout(() => {
			commitSearch(searchInput);
		}, SEARCH_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [searchInput, filters, commitSearch]);

	useEffect(() => {
		const next = `?${buildExplorerSearchParams(filters, page)}`;
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

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog === null) {
			return;
		}
		return bindDialogLightDismiss(dialog);
	}, []);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog === null) {
			return;
		}
		if (selected !== null && !dialog.open) {
			dialog.showModal();
		}
		if (selected === null && dialog.open) {
			dialog.close();
		}
	}, [selected]);

	function goToPage(next: number): void {
		setPage(next);
		setPageInput(String(next + 1));
		setSelected(null);
	}

	function applyFromControls(next: Filters): void {
		applyFilters({ ...next, search: searchInput.trim() }, 0);
	}

	function submitFilters(event: SubmitEvent<HTMLFormElement>): void {
		event.preventDefault();
		commitSearch(searchInput);
	}

	function resetFilters(): void {
		setSearchInput(EMPTY_FILTERS.search);
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
	const advancedCount = (filters.quality ? 1 : 0)
		+ (filters.type ? 1 : 0)
		+ (filters.sort !== "name" ? 1 : 0)
		+ (filters.order !== "asc" ? 1 : 0);
	const requestError = query.error instanceof ItemsRequestError ? query.error : null;
	const errorMessage = requestError?.message ?? "The list request failed";
	const errorRetryable = requestError?.retryable ?? true;
	const resultSummary = query.isFetching && !query.isPending
		? "Updating from the network"
		: query.isError
			? errorMessage
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
				<button
					className={copyStatus.startsWith("Copied") ? "item-button-copy is-copied" : "item-button-copy"}
					type="button"
					onClick={() => void copyRequest()}
				>
					Copy /v1/items
				</button>
				<span
					className={copyStatus === "Copy failed" ? "item-copy-status is-visible" : "item-copy-status"}
					aria-live="polite"
				>
					{copyStatus}
				</span>
			</div>
			<p className="item-request-hint">Fetched via /api/items so the key stays on the server.</p>

			<form className="item-filters" onSubmit={submitFilters}>
				<div className="item-filter-search">
					<label htmlFor="item-search">search</label>
					<div className="item-search-row">
						<input
							id="item-search"
							name="search"
							type="search"
							placeholder="Brimstone"
							maxLength={100}
							value={searchInput}
							onChange={(event) => setSearchInput(event.target.value)}
						/>
						<button className="item-button-secondary" type="button" onClick={resetFilters}>Reset</button>
					</div>
				</div>
				<details className="item-filter-more">
					<summary>
						More filters{advancedCount > 0 ? ` · ${advancedCount} set` : ""}
					</summary>
					<div className="item-filter-fields">
					<div className="item-filter-group">
						<div>
							<label htmlFor="item-type">type</label>
							<select
								id="item-type"
								name="type"
								value={filters.type}
								onChange={(event) => applyFromControls({ ...filters, type: event.target.value })}
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
								value={filters.quality}
								onChange={(event) => applyFromControls({ ...filters, quality: event.target.value })}
							>
								<option value="">Any</option>
								{[0, 1, 2, 3, 4].map((quality) => (
									<option key={quality} value={quality}>{quality}</option>
								))}
							</select>
						</div>
					</div>
					<div className="item-filter-group">
						<div>
							<label htmlFor="item-sort">sort</label>
							<select
								id="item-sort"
								name="sort"
								value={filters.sort}
								onChange={(event) => applyFromControls({ ...filters, sort: event.target.value })}
							>
								<option value="name">name</option>
								<option value="quality">quality</option>
								<option value="game_id">game_id</option>
							</select>
						</div>
						<div>
							<label htmlFor="item-order">order</label>
							<select
								id="item-order"
								name="order"
								value={filters.order}
								onChange={(event) => applyFromControls({ ...filters, order: event.target.value })}
							>
								<option value="asc">asc</option>
								<option value="desc">desc</option>
							</select>
						</div>
					</div>
					<div className="item-filter-group">
						<div>
							<label htmlFor="item-limit">limit</label>
							<select
								id="item-limit"
								name="limit"
								value={filters.limit}
								onChange={(event) => applyFromControls({ ...filters, limit: Number(event.target.value) })}
							>
								{(LIMIT_CHOICES.includes(filters.limit) ? LIMIT_CHOICES : [filters.limit, ...LIMIT_CHOICES]).map(
									(choice) => (
										<option key={choice} value={choice}>{choice}</option>
									),
								)}
							</select>
						</div>
					</div>
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
							<li className="item-card-skeleton" key={index}>
								<div className="item-image item-skeleton-block"></div>
								<div className="item-skeleton-line item-skeleton-title"></div>
							</li>
						))}
					</ul>
				</div>
			) : query.isError ? (
				<div className="item-state" role="alert">
					<p className="item-state-title">{errorMessage}</p>
					{errorRetryable && (
						<p>Retry the same query. If it keeps failing, send the request ID with the support ticket.</p>
					)}
					{requestError?.requestId && (
						<p className="item-request-id">Request ID: <code>{requestError.requestId}</code></p>
					)}
					{errorRetryable && (
						<button className="item-button-primary" type="button" onClick={() => void query.refetch()}>
							Try again
						</button>
					)}
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
					{query.data.items.map((item) => (
						<li key={item.gameId}>
							<button
								type="button"
								className="item-card"
								aria-haspopup="dialog"
								aria-controls="item-detail"
								aria-expanded={selected !== null && selected.gameId === item.gameId}
								onClick={() => setSelected(item)}
							>
								<ItemCard {...item} />
							</button>
						</li>
					))}
				</ul>
			)}

			{query.data && query.data.items.length > 0 && (
				<details
					className="item-json"
					onToggle={(event) => setJsonOpen(event.currentTarget.open)}
				>
					<summary>Response JSON</summary>
					{jsonOpen && <pre><code>{JSON.stringify(query.data, null, 2)}</code></pre>}
				</details>
			)}

			<dialog
				ref={dialogRef}
				id="item-detail"
				className="item-detail"
				closedby="any"
				aria-labelledby={selected === null ? undefined : "item-detail-title"}
				onClose={() => setSelected(null)}
			>
				{selected !== null && <ItemDetail {...selected} />}
			</dialog>

			{query.data && query.data.total > 0 && pageCount > 1 && (
				<nav className="item-pagination" aria-label="Item results pages">
					<button
						className="item-pagination-step"
						type="button"
						disabled={page === 0 || query.isPlaceholderData}
						onClick={() => goToPage(Math.max(0, page - 1))}
					>
						Previous
					</button>
					<label className="item-page-jump">
						<span>Page</span>
						<input
							id="item-page"
							name="page"
							type="number"
							inputMode="numeric"
							min={1}
							max={pageCount}
							value={pageInput}
							disabled={query.isPlaceholderData}
							onChange={(event) => setPageInput(event.target.value)}
							onBlur={(event) => commitPageInput(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									commitPageInput(event.currentTarget.value);
								}
							}}
						/>
						<span>of {pageCount}</span>
					</label>
					<button
						className="item-pagination-step"
						type="button"
						disabled={page + 1 >= pageCount || query.isPlaceholderData}
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
