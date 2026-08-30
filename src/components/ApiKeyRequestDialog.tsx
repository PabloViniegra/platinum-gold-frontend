import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { useForm, useWatch } from "react-hook-form";

import { OCCUPATIONS } from "../lib/api-key-requests/occupations";
import "./api-key-request-dialog.css";

type RequestForm = {
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: string;
	useCaseDetails: string;
	website: string;
};

type FieldErrorProps = {
	id: string;
	message: string | undefined;
};

const TOAST_KIND = {
	SUCCESS: "success",
	ERROR: "error",
} as const;

type ToastKind = (typeof TOAST_KIND)[keyof typeof TOAST_KIND];

type ToastState = {
	kind: ToastKind;
	message: string;
};

function FieldError({ id, message }: FieldErrorProps) {
	return <span id={id} className="request-field-error">{message}</span>;
}

type MessageBody = {
	message: string;
};

async function messageFromResponse(response: Response): Promise<string> {
	try {
		const payload: MessageBody = await response.json();
		if (payload.message?.constructor === String && payload.message.trim().length > 0) {
			return payload.message;
		}
	} catch {
	}
	if (response.status === 429) return "Too many requests. Please try again later.";
	return "Your request could not be submitted. Please try again.";
}

function bindDialogLightDismiss(dialog: HTMLDialogElement, isBusy: () => boolean): () => void {
	if ("closedBy" in HTMLDialogElement.prototype) return () => {};

	function onBackdropClick(event: MouseEvent): void {
		if (isBusy() || event.target !== dialog) return;
		const rect = dialog.getBoundingClientRect();
		const inside = rect.top <= event.clientY
			&& event.clientY <= rect.bottom
			&& rect.left <= event.clientX
			&& event.clientX <= rect.right;
		if (!inside) dialog.close();
	}

	dialog.addEventListener("click", onBackdropClick);
	return () => dialog.removeEventListener("click", onBackdropClick);
}

export const REQUEST_ACCESS_PLACEMENT = {
	HERO: "hero",
	NAV: "nav",
} as const;

type RequestAccessPlacement = (typeof REQUEST_ACCESS_PLACEMENT)[keyof typeof REQUEST_ACCESS_PLACEMENT];

type ApiKeyRequestDialogProps = {
	placement: RequestAccessPlacement;
};

export function ApiKeyRequestDialog({ placement }: ApiKeyRequestDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const errorToastRef = useRef<HTMLOutputElement>(null);
	const successToastRef = useRef<HTMLOutputElement>(null);
	const [toast, setToast] = useState<ToastState | null>(null);
	const [countries, setCountries] = useState<string[]>([]);
	const [countriesUnavailable, setCountriesUnavailable] = useState(false);
	const generationRef = useRef(0);
	const submittingRef = useRef(false);
	const {
		register,
		handleSubmit,
		reset,
		clearErrors,
		control,
		formState: { errors, isSubmitting },
	} = useForm<RequestForm>({ mode: "onBlur", shouldUnregister: true });
	const useCase = useWatch({ control, name: "useCase" });

	useEffect(() => {
		submittingRef.current = isSubmitting;
	}, [isSubmitting]);

	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		return bindDialogLightDismiss(dialog, () => submittingRef.current);
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		async function loadCountries(): Promise<void> {
			try {
				const response = await fetch("/api/countries", { signal: controller.signal });
				if (!response.ok) {
					setCountriesUnavailable(true);
					return;
				}
				const payload: { countries: string[] } = await response.json();
				if (!Array.isArray(payload.countries)) {
					setCountriesUnavailable(true);
					return;
				}
				setCountries(payload.countries.filter((name) => name?.constructor === String));
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") return;
				setCountriesUnavailable(true);
			}
		}
		void loadCountries();
		return () => controller.abort();
	}, []);

	useEffect(() => {
		const errorElement = errorToastRef.current;
		const successElement = successToastRef.current;
		if (!toast) {
			if (errorElement?.matches(":popover-open")) errorElement.hidePopover();
			if (successElement?.matches(":popover-open")) successElement.hidePopover();
			return;
		}
		const element = toast.kind === TOAST_KIND.ERROR ? errorElement : successElement;
		const inactiveElement = toast.kind === TOAST_KIND.ERROR ? successElement : errorElement;
		if (!element) return;
		if (inactiveElement?.matches(":popover-open")) inactiveElement.hidePopover();
		if ("showPopover" in element && !element.matches(":popover-open")) element.showPopover();
		if (toast.kind === TOAST_KIND.ERROR) return;
		const timer = window.setTimeout(() => setToast(null), 6_000);
		return () => window.clearTimeout(timer);
	}, [toast]);

	function openDialog(): void {
		generationRef.current += 1;
		setToast(null);
		dialogRef.current?.showModal();
	}

	function closeDialog(): void {
		if (submittingRef.current) return;
		dialogRef.current?.close();
	}

	function finishDialog(): void {
		dialogRef.current?.close();
	}

	async function submitRequest(values: RequestForm): Promise<void> {
		const generation = generationRef.current;
		submittingRef.current = true;
		try {
			const response = await fetch("/api/key-requests", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName: values.firstName,
					lastName: values.lastName,
					email: values.email,
					country: values.country,
					occupation: values.occupation,
					useCase: values.useCase,
					useCaseDetails: values.useCase === "other" ? values.useCaseDetails : undefined,
					website: values.website,
				}),
			});
			if (generation !== generationRef.current) return;
			if (!response.ok) {
				setToast({
					kind: TOAST_KIND.ERROR,
					message: await messageFromResponse(response),
				});
				return;
			}
			reset();
			finishDialog();
			setToast({ kind: TOAST_KIND.SUCCESS, message: "Your request has joined the waiting list." });
		} catch {
			if (generation !== generationRef.current) return;
			setToast({
				kind: TOAST_KIND.ERROR,
				message: "Your request could not be submitted. Check your connection and try again.",
			});
		}
	}

	function submitForm(event: SubmitEvent<HTMLFormElement>): void {
		void handleSubmit(submitRequest)(event);
	}

	return (
		<>
			<button
				ref={triggerRef}
				className="request-access-trigger"
				type="button"
				data-placement={placement}
				onClick={openDialog}
			>
				Request API access
			</button>
			<dialog
				ref={dialogRef}
				className="request-dialog"
				closedby={isSubmitting ? "none" : "any"}
				aria-labelledby="request-dialog-title"
				aria-describedby="request-dialog-description"
				onCancel={(event) => { if (isSubmitting) event.preventDefault(); }}
				onClose={() => {
					triggerRef.current?.focus();
					// Closing blurs the autofocused field, which fires onBlur validation; clear after that synthetic blur lands.
					window.setTimeout(() => clearErrors(), 0);
				}}
			>
				<header className="request-dialog-header">
					<h2 id="request-dialog-title">Request an API key</h2>
					<button className="request-dialog-close" type="button" onClick={closeDialog} disabled={isSubmitting}>Close</button>
				</header>
				<p id="request-dialog-description" className="request-dialog-description">
					Tell us what you are building. Every request is reviewed manually.
				</p>
				<output
					ref={errorToastRef}
					className="request-toast"
					data-visible={toast?.kind === TOAST_KIND.ERROR ? "true" : undefined}
					data-kind="error"
					popover="manual"
					aria-live="polite"
				>
					<span>{toast?.kind === TOAST_KIND.ERROR ? toast.message : ""}</span>
					{toast?.kind === TOAST_KIND.ERROR && (
						<button type="button" onClick={() => setToast(null)}>Close</button>
					)}
				</output>
				<form className="request-form" noValidate onSubmit={submitForm}>
					<div className="request-form-grid">
						<label className="request-field" htmlFor="request-first-name">
							<span>First name</span>
							<input
								id="request-first-name"
								autoFocus
								autoComplete="name"
								aria-invalid={errors.firstName ? "true" : "false"}
								aria-describedby={errors.firstName ? "request-first-name-error" : undefined}
								{...register("firstName", { required: "Enter your first name.", maxLength: { value: 80, message: "Use 80 characters or fewer." } })}
							/>
							<FieldError id="request-first-name-error" message={errors.firstName?.message} />
						</label>
						<label className="request-field" htmlFor="request-last-name">
							<span>Last name</span>
							<input
								id="request-last-name"
								autoComplete="name"
								aria-invalid={errors.lastName ? "true" : "false"}
								aria-describedby={errors.lastName ? "request-last-name-error" : undefined}
								{...register("lastName", { required: "Enter your last name.", maxLength: { value: 100, message: "Use 100 characters or fewer." } })}
							/>
							<FieldError id="request-last-name-error" message={errors.lastName?.message} />
						</label>
					</div>
					<label className="request-field" htmlFor="request-email">
						<span>Email</span>
						<input
							id="request-email"
							type="email"
							autoComplete="email"
							inputMode="email"
							aria-invalid={errors.email ? "true" : "false"}
							aria-describedby={errors.email ? "request-email-error" : undefined}
							{...register("email", {
								required: "Enter your email address.",
								maxLength: { value: 254, message: "Use 254 characters or fewer." },
								pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/u, message: "Enter a valid email address." },
							})}
						/>
						<FieldError id="request-email-error" message={errors.email?.message} />
					</label>
					<div className="request-form-grid">
						<label className="request-field" htmlFor="request-country">
							<span>Country</span>
							<select
								id="request-country"
								autoComplete="country-name"
								defaultValue=""
								disabled={countries.length === 0}
								aria-invalid={errors.country ? "true" : "false"}
								aria-describedby={errors.country ? "request-country-error" : undefined}
								{...register("country", { required: "Choose your country." })}
							>
								<option value="" disabled>{countries.length === 0 ? (countriesUnavailable ? "Could not load countries. Refresh to try again." : "Loading countries...") : "Select one"}</option>
								{countries.map((name) => (
									<option key={name} value={name}>{name}</option>
								))}
							</select>
							<FieldError id="request-country-error" message={errors.country?.message} />
						</label>
						<label className="request-field" htmlFor="request-occupation">
							<span>Occupation</span>
							<select
								id="request-occupation"
								autoComplete="organization-title"
								defaultValue=""
								aria-invalid={errors.occupation ? "true" : "false"}
								aria-describedby={errors.occupation ? "request-occupation-error" : undefined}
								{...register("occupation", { required: "Choose your occupation." })}
							>
								<option value="" disabled>Select one</option>
								{OCCUPATIONS.map((name) => (
									<option key={name} value={name}>{name}</option>
								))}
							</select>
							<FieldError id="request-occupation-error" message={errors.occupation?.message} />
						</label>
					</div>
					<label className="request-field" htmlFor="request-use-case">
						<span>What will you use the API for?</span>
						<select
							id="request-use-case"
							defaultValue=""
							aria-invalid={errors.useCase ? "true" : "false"}
							aria-describedby={errors.useCase ? "request-use-case-error" : undefined}
							{...register("useCase", { required: "Choose a use case." })}
						>
							<option value="" disabled>Select one</option>
							<option value="personal_project">Personal project</option>
							<option value="research">Research</option>
							<option value="education">Education</option>
							<option value="commercial_evaluation">Commercial evaluation</option>
							<option value="other">Other</option>
						</select>
						<FieldError id="request-use-case-error" message={errors.useCase?.message} />
					</label>
					{useCase === "other" && (
						<label className="request-field" htmlFor="request-use-case-details">
							<span>Tell us more</span>
							<textarea
								id="request-use-case-details"
								rows={4}
								aria-invalid={errors.useCaseDetails ? "true" : "false"}
								aria-describedby={errors.useCaseDetails ? "request-use-case-details-error" : undefined}
								{...register("useCaseDetails", { required: "Describe how you will use the API.", maxLength: { value: 1_000, message: "Use 1,000 characters or fewer." } })}
							/>
							<FieldError id="request-use-case-details-error" message={errors.useCaseDetails?.message} />
						</label>
					)}
					<label className="request-honeypot" aria-hidden="true">
						Website
						<input aria-hidden="true" tabIndex={-1} autoComplete="off" {...register("website")} />
					</label>
					<p className="request-privacy-note">
						We only use these details to review and manage your API access request.
					</p>
					<div className="request-form-actions">
						<button className="request-cancel" type="button" onClick={closeDialog} disabled={isSubmitting}>Cancel</button>
						<button className="request-submit" type="submit" disabled={isSubmitting}>
							{isSubmitting ? "Sending request..." : "Join the waiting list"}
						</button>
					</div>
				</form>
			</dialog>
			<output
				ref={successToastRef}
				className="request-toast"
				data-visible={toast?.kind === TOAST_KIND.SUCCESS ? "true" : undefined}
				data-kind="success"
				popover="manual"
				aria-live="polite"
			>
				<span>{toast?.kind === TOAST_KIND.SUCCESS ? toast.message : ""}</span>
				{toast?.kind === TOAST_KIND.SUCCESS && (
					<button type="button" onClick={() => setToast(null)}>Close</button>
				)}
			</output>
		</>
	);
}
