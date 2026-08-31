import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";

import type { ApiKeyUseCase } from "../lib/api-key-requests/contracts";
import type { EmailDeliveryStatus } from "../lib/api-key-requests/repository";
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
	applicantEmailAccepted: boolean;
	applicantEmailStatus: EmailDeliveryStatus | null;
	adminEmailAccepted: boolean;
	adminEmailStatus: EmailDeliveryStatus | null;
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

type IntakeRetryResponse = {
	applicantEmailAccepted: boolean;
	adminEmailAccepted: boolean;
};

async function loadQueue(signal?: AbortSignal): Promise<PendingRequest[]> {
	const response = await fetch("/api/admin/key-requests", signal ? { signal } : undefined);
	if (!response.ok) throw new Error("Queue unavailable");
	const payload: QueueResponse = await response.json();
	return payload.requests;
}

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

function deliveryLabel(accepted: boolean, status: EmailDeliveryStatus | null): string {
	if (!accepted) return "Missing";
	switch (status) {
		case "sent":
			return "Sent by Resend";
		case "delivered":
			return "Delivered to recipient server";
		case "delivery_delayed":
			return "Delivery delayed";
		case "complained":
			return "Marked as spam";
		case "bounced":
			return "Bounced";
		case "failed":
			return "Delivery failed";
		case "suppressed":
			return "Suppressed by Resend";
		default:
			return "Accepted by Resend";
	}
}

type MessageBody = {
	message: string;
};

async function loginErrorMessage(response: Response): Promise<string> {
	try {
		const payload: MessageBody = await response.json();
		if (payload.message?.constructor === String && payload.message.trim().length > 0) {
			if (response.status === 401) return "Invalid credentials. Check the username and password.";
			return payload.message;
		}
	} catch {
	}
	if (response.status === 429) return "Too many attempts. Try again later.";
	return "Invalid credentials. Check the username and password.";
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
	const [retryingId, setRetryingId] = useState<string | null>(null);
	const [retryMessage, setRetryMessage] = useState("");
	const [retryFailed, setRetryFailed] = useState(false);
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
		if (!apiKey && !confirmation) return;
		function onBeforeUnload(event: BeforeUnloadEvent): void {
			event.preventDefault();
			event.returnValue = "";
		}
		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [apiKey, confirmation]);

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
				setRequests(await loadQueue(controller.signal));
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
				document.getElementById("admin-username")?.focus();
				return;
			}
			setPassword("");
			setRequests(await loadQueue());
			setView(ADMIN_VIEW.QUEUE);
		} catch {
			setMessage("Administration is unavailable. Try again.");
			document.getElementById("admin-username")?.focus();
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
			setRetryMessage("");
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

	async function retryIntake(request: PendingRequest): Promise<void> {
		setRetryingId(request.id);
		setRetryMessage("");
		setRetryFailed(false);
		try {
			const response = await fetch(
				`/api/admin/key-requests/${encodeURIComponent(request.id)}/retry-intake`,
				{ method: "POST" },
			);
			if (!response.ok) {
				if (response.status === 409) {
					setRequests(await loadQueue());
					setRetryMessage("The request changed while retrying. The queue has been refreshed.");
				} else {
					setRetryFailed(true);
					setRetryMessage("Intake emails could not be recovered. Try again.");
				}
				requestAnimationFrame(() => titleRef.current?.focus());
				return;
			}
			const acceptance: IntakeRetryResponse = await response.json();
			if (acceptance.applicantEmailAccepted?.constructor !== Boolean
				|| acceptance.adminEmailAccepted?.constructor !== Boolean) {
				throw new Error("Invalid retry response");
			}
			setRequests(await loadQueue());
			setRetryMessage("Missing intake emails were accepted by Resend.");
			requestAnimationFrame(() => titleRef.current?.focus());
		} catch {
			setRetryFailed(true);
			setRetryMessage("Intake emails could not be recovered. Check your connection.");
		} finally {
			setRetryingId(null);
		}
	}

	if (view === ADMIN_VIEW.LOADING) return <output className="admin-state">Loading requests…</output>;
	if (view === ADMIN_VIEW.ERROR) return <p className="admin-state">Administration is unavailable. Refresh the page and try again.</p>;
	if (view === ADMIN_VIEW.LOGIN) {
		return (
			<form className="admin-login" onSubmit={(event) => void login(event)}>
				<h1>Request administration</h1>
				<p>Sign in to review pending API access requests.</p>
				<label htmlFor="admin-username">Username</label>
				<input id="admin-username" name="username" autoComplete="username" spellCheck={false} value={username} onChange={(event) => setUsername(event.target.value)} required />
				<label htmlFor="admin-password">Password</label>
				<input id="admin-password" name="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
				{message && <p className="admin-error" role="alert">{message}</p>}
				<button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
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
			{retryMessage && (
				<p className={retryFailed ? "admin-error" : "admin-notice"} role={retryFailed ? "alert" : "status"}>{retryMessage}</p>
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
								<div><dt>Applicant email</dt><dd>{deliveryLabel(request.applicantEmailAccepted, request.applicantEmailStatus)}</dd></div>
								<div><dt>Admin email</dt><dd>{deliveryLabel(request.adminEmailAccepted, request.adminEmailStatus)}</dd></div>
							</dl>
							<div className="admin-request-actions">
								{request.status === ADMIN_REQUEST_STATUS.PENDING
									&& (!request.applicantEmailAccepted || !request.adminEmailAccepted) && (
									<button
										className="admin-retry"
										type="button"
										disabled={retryingId !== null}
										aria-label={`Retry missing intake emails for ${request.firstName} ${request.lastName}`}
										onClick={() => void retryIntake(request)}
									>
										{retryingId === request.id ? "Retrying…" : "Retry missing intake emails"}
									</button>
								)}
								{request.status !== ADMIN_REQUEST_STATUS.DENYING && (
									<button type="button" disabled={retryingId !== null} onClick={() => openApproval(request)}>
										{request.status === ADMIN_REQUEST_STATUS.APPROVING ? "Retry approval" : "Approve and send key"}
									</button>
								)}
								{request.status !== ADMIN_REQUEST_STATUS.APPROVING && (
									<button className="admin-deny" type="button" disabled={retryingId !== null} onClick={() => openDenial(request)}>
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
						name="apiKey"
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
						name="confirmation"
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
						<button type="submit" disabled={submitting}>{submitting ? "Sending…" : "Approve and send"}</button>
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
						{submitting ? "Sending…" : "Deny and email"}
					</button>
				</div>
			</dialog>
		</section>
	);
}
