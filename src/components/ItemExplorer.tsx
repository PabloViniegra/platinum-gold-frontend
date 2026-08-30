import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { type SubmitEvent, useEffect, useRef, useState } from "react";

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
	const [draft, setDraft] = useState<Filters>(() => filtersFromParams(startup));
	const [filters, setFilters] = useState<Filters>(() => filtersFromParams(startup));
	const [page, setPage] = useState(() => explorerPage(startup));
	const [copyStatus, setCopyStatus] = useState("");
	const [pageInput, setPageInput] = useState(() => String(explorerPage(startup) + 1));
	const [selected, setSelected] = useState<Item | null>(null);
	const dialogRef = useRef<HTMLDialogElement>(null);
	const path = requestPath(filters, page);
	const contractLine = contractRequestLine(filters, page);
	const isDirty = draft.search.trim() !== filters.search
		|| draft.quality !== filters.quality
		|| draft.type !== filters.type
		|| draft.sort !== filters.sort
		|| draft.order !== filters.order
		|| draft.limit !== filters.limit;
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

	function applyFilters(next: Filters, nextPage: number): void {
		setDraft(next);
		setFilters(next);
		setPage(nextPage);
		setPageInput(String(nextPage + 1));
		setCopyStatus("");
		setSelected(null);
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
				<details className="item-json">
					<summary>Response JSON</summary>
					<pre><code>{JSON.stringify(query.data, null, 2)}</code></pre>
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
							id="item-page"
							name="page"
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
