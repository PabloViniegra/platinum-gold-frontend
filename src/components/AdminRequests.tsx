import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import type { ApiKeyUseCase } from "../lib/api-key-requests/contracts";
import "./admin-requests.css";

type PendingRequest = {
	id: string;
	status: AdminRequestStatus;
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: ApiKeyUseCase;
	useCaseDetails: string | null;
	createdAt: string;
};

const ADMIN_REQUEST_STATUS = {
	PENDING: "pending",
	APPROVING: "approving",
	DENYING: "denying",
} as const;

type AdminRequestStatus = (typeof ADMIN_REQUEST_STATUS)[keyof typeof ADMIN_REQUEST_STATUS];

type QueueResponse = {
	requests: PendingRequest[];
};

type SessionResponse = {
	authenticated: boolean;
};

const ADMIN_VIEW = {
	LOADING: "loading",
	LOGIN: "login",
	QUEUE: "queue",
	ERROR: "error",
} as const;

type AdminView = (typeof ADMIN_VIEW)[keyof typeof ADMIN_VIEW];

function formatUseCase(useCase: ApiKeyUseCase): string {
	return useCase.split("_").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");
}

type MessageBody = {
	message: string;
};

async function loginErrorMessage(response: Response): Promise<string> {
	try {
		const payload: MessageBody = await response.json();
		if (payload.message?.constructor === String && payload.message.trim().length > 0) {
			return payload.message;
		}
	} catch {
	}
	if (response.status === 429) return "Too many attempts. Try again later.";
	return "Invalid credentials.";
}

export function AdminRequests() {
	const [view, setView] = useState<AdminView>(ADMIN_VIEW.LOADING);
	const [requests, setRequests] = useState<PendingRequest[]>([]);
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [message, setMessage] = useState("");
	const [selected, setSelected] = useState<PendingRequest | null>(null);
	const [apiKey, setApiKey] = useState("");
	const [confirmation, setConfirmation] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const approvalDialogRef = useRef<HTMLDialogElement>(null);
	const denialDialogRef = useRef<HTMLDialogElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const keyInputRef = useRef<HTMLInputElement>(null);
	const generationRef = useRef(0);
	const submittingRef = useRef(false);
	const keyMismatch = message === "The API keys must match.";

	useEffect(() => {
		submittingRef.current = submitting;
	}, [submitting]);

	useEffect(() => {
		const controller = new AbortController();
		async function load(): Promise<void> {
			try {
				const sessionResponse = await fetch("/api/admin/session", { signal: controller.signal });
				if (!sessionResponse.ok) throw new Error("Session unavailable");
				const session: SessionResponse = await sessionResponse.json();
				if (!session.authenticated) {
					setView(ADMIN_VIEW.LOGIN);
					return;
				}
				const response = await fetch("/api/admin/key-requests", { signal: controller.signal });
				if (!response.ok) throw new Error("Queue unavailable");
				const payload: QueueResponse = await response.json();
				setRequests(payload.requests);
				setView(ADMIN_VIEW.QUEUE);
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setView(ADMIN_VIEW.ERROR);
			}
		}
		void load();
		return () => controller.abort();
	}, []);

	async function login(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		setSubmitting(true);
		setMessage("");
		try {
			const response = await fetch("/api/admin/session", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			if (!response.ok) {
				setMessage(await loginErrorMessage(response));
				return;
			}
			setPassword("");
			const queueResponse = await fetch("/api/admin/key-requests");
			if (!queueResponse.ok) throw new Error("Queue unavailable");
			const payload: QueueResponse = await queueResponse.json();
			setRequests(payload.requests);
			setView(ADMIN_VIEW.QUEUE);
		} catch {
			setMessage("Administration is unavailable. Try again.");
		} finally {
			setSubmitting(false);
		}
	}

	async function logout(): Promise<void> {
		try {
			const response = await fetch("/api/admin/session", { method: "DELETE" });
			if (!response.ok) {
				setMessage("Sign out failed. Try again.");
				return;
			}
			setRequests([]);
			setMessage("");
			setView(ADMIN_VIEW.LOGIN);
		} catch {
			setMessage("Sign out failed. Check your connection.");
		}
	}

	function openApproval(request: PendingRequest): void {
		generationRef.current += 1;
		setSelected(request);
		setApiKey("");
		setConfirmation("");
		setMessage("");
		requestAnimationFrame(() => approvalDialogRef.current?.showModal());
	}

	function openDenial(request: PendingRequest): void {
		generationRef.current += 1;
		setSelected(request);
		setMessage("");
		requestAnimationFrame(() => denialDialogRef.current?.showModal());
	}

	function closeApproval(): void {
		if (submittingRef.current) return;
		approvalDialogRef.current?.close();
	}

	function closeDenial(): void {
		if (submittingRef.current) return;
		denialDialogRef.current?.close();
	}

	function resetApproval(): void {
		setSelected(null);
		setApiKey("");
		setConfirmation("");
		setMessage("");
	}

	async function approve(event: SubmitEvent<HTMLFormElement>): Promise<void> {
		event.preventDefault();
		if (!selected) return;
		if (!apiKey.trim() || apiKey !== confirmation) {
			setMessage("The API keys must match.");
			keyInputRef.current?.focus();
			return;
		}
		const generation = generationRef.current;
		const approvedId = selected.id;
		submittingRef.current = true;
		setSubmitting(true);
		setMessage("");
		try {
			const response = await fetch(`/api/admin/key-requests/${encodeURIComponent(approvedId)}/approve`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apiKey, confirmation }),
			});
			if (generation !== generationRef.current) return;
			if (!response.ok) {
				setMessage(response.status === 409
					? "This request is no longer pending."
					: "Approval could not be completed. Try again.");
				return;
			}
			setRequests((current) => current.filter((request) => request.id !== approvedId));
			approvalDialogRef.current?.close();
			requestAnimationFrame(() => titleRef.current?.focus());
		} catch {
			if (generation !== generationRef.current) return;
			setMessage("Approval could not be completed. Check your connection.");
		} finally {
			if (generation === generationRef.current) setSubmitting(false);
		}
	}

	async function deny(): Promise<void> {
		if (!selected) return;
		const generation = generationRef.current;
		const deniedId = selected.id;
		submittingRef.current = true;
		setSubmitting(true);
		setMessage("");
		try {
			const response = await fetch(`/api/admin/key-requests/${encodeURIComponent(deniedId)}/deny`, {
				method: "POST",
			});
			if (generation !== generationRef.current) return;
			if (!response.ok) {
				setMessage(response.status === 409
					? "This request is no longer pending."
					: "Denial could not be completed. Try again.");
				return;
			}
			setRequests((current) => current.filter((request) => request.id !== deniedId));
			denialDialogRef.current?.close();
			requestAnimationFrame(() => titleRef.current?.focus());
		} catch {
			if (generation !== generationRef.current) return;
			setMessage("Denial could not be completed. Check your connection.");
		} finally {
			if (generation === generationRef.current) setSubmitting(false);
		}
	}

	if (view === ADMIN_VIEW.LOADING) return <output className="admin-state">Loading requests...</output>;
	if (view === ADMIN_VIEW.ERROR) return <p className="admin-state">Administration is unavailable.</p>;
	if (view === ADMIN_VIEW.LOGIN) {
		return (
			<form className="admin-login" onSubmit={(event) => void login(event)}>
				<h1>Request administration</h1>
				<p>Sign in to review pending API access requests.</p>
				<label htmlFor="admin-username">Username</label>
				<input id="admin-username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required />
				<label htmlFor="admin-password">Password</label>
				<input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
				{message && <p className="admin-error" role="alert">{message}</p>}
				<button type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"}</button>
			</form>
		);
	}

	return (
		<section className="admin-queue" aria-labelledby="admin-title">
			<header>
				<div>
					<p className="admin-kicker">Control room</p>
					<h1 id="admin-title" ref={titleRef} tabIndex={-1}>Pending requests</h1>
				</div>
				<button type="button" onClick={() => void logout()}>Sign out</button>
			</header>
			{message && view === ADMIN_VIEW.QUEUE && !selected && (
				<p className="admin-error" role="alert">{message}</p>
			)}
			{requests.length === 0 ? (
				<p className="admin-empty">The waiting list is clear.</p>
			) : (
				<ul className="admin-request-list">
					{requests.map((request) => (
						<li key={request.id}>
							<header><h2>{request.firstName} {request.lastName}</h2><time dateTime={request.createdAt}>{new Date(request.createdAt).toLocaleString("en")}</time></header>
							<dl>
								<div><dt>Email</dt><dd>{request.email}</dd></div>
								<div><dt>Country</dt><dd>{request.country}</dd></div>
								<div><dt>Occupation</dt><dd>{request.occupation}</dd></div>
								<div><dt>Use case</dt><dd>{formatUseCase(request.useCase)}</dd></div>
								{request.useCaseDetails && <div><dt>Details</dt><dd>{request.useCaseDetails}</dd></div>}
							</dl>
							<div className="admin-request-actions">
								{request.status !== ADMIN_REQUEST_STATUS.DENYING && (
									<button type="button" onClick={() => openApproval(request)}>
										{request.status === ADMIN_REQUEST_STATUS.APPROVING ? "Retry approval" : "Approve and send key"}
									</button>
								)}
								{request.status !== ADMIN_REQUEST_STATUS.APPROVING && (
									<button className="admin-deny" type="button" onClick={() => openDenial(request)}>
										{request.status === ADMIN_REQUEST_STATUS.DENYING ? "Retry denial" : "Deny request"}
									</button>
								)}
							</div>
						</li>
					))}
				</ul>
			)}
			<dialog
				ref={approvalDialogRef}
				className="admin-approval"
				closedby={submitting ? "none" : "any"}
				aria-labelledby="approval-title"
				onCancel={(event) => { if (submitting) event.preventDefault(); }}
				onClose={resetApproval}
			>
				<h2 id="approval-title">Approve {selected?.firstName}</h2>
				<p>The key is sent by email and is not stored.</p>
				<form onSubmit={(event) => void approve(event)}>
					<label htmlFor="approval-key">API key</label>
					<input
						id="approval-key"
						ref={keyInputRef}
						type="password"
						autoComplete="off"
						value={apiKey}
						aria-invalid={keyMismatch ? "true" : "false"}
						aria-describedby={keyMismatch ? "approval-key-error" : undefined}
						onChange={(event) => setApiKey(event.target.value)}
						required
					/>
					<label htmlFor="approval-confirmation">Confirm API key</label>
					<input
						id="approval-confirmation"
						type="password"
						autoComplete="off"
						value={confirmation}
						aria-invalid={keyMismatch ? "true" : "false"}
						aria-describedby={keyMismatch ? "approval-key-error" : undefined}
						onChange={(event) => setConfirmation(event.target.value)}
						required
					/>
					{message && <p id="approval-key-error" className="admin-error" role="alert">{message}</p>}
					<div className="admin-actions">
						<button type="button" onClick={closeApproval} disabled={submitting}>Cancel</button>
						<button type="submit" disabled={submitting}>{submitting ? "Sending..." : "Approve and send"}</button>
					</div>
				</form>
			</dialog>
			<dialog
				ref={denialDialogRef}
				className="admin-approval"
				closedby={submitting ? "none" : "any"}
				aria-labelledby="denial-title"
				onCancel={(event) => { if (submitting) event.preventDefault(); }}
				onClose={resetApproval}
			>
				<h2 id="denial-title">Deny {selected?.firstName}</h2>
				<p>We will email the applicant that access was not granted. No API key is sent.</p>
				{message && <p className="admin-error" role="alert">{message}</p>}
				<div className="admin-actions">
					<button type="button" onClick={closeDenial} disabled={submitting}>Cancel</button>
					<button className="admin-deny" type="button" onClick={() => void deny()} disabled={submitting}>
						{submitting ? "Sending..." : "Deny and email"}
					</button>
				</div>
			</dialog>
		</section>
	);
}
