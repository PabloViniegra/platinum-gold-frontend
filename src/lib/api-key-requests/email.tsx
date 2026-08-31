import { Resend } from "resend";
import type { ReactElement } from "react";

import { AdminRequestEmail } from "../../emails/AdminRequestEmail";
import { ApiKeyApprovedEmail } from "../../emails/ApiKeyApprovedEmail";
import { ApiKeyDeniedEmail } from "../../emails/ApiKeyDeniedEmail";
import { WaitingListEmail } from "../../emails/WaitingListEmail";
import type { ApiKeyRequest } from "./contracts";

export type EmailMessage = {
	from: string;
	to: string;
	subject: string;
	react: ReactElement;
	tags: EmailTag[];
};

type EmailTag = {
	name: string;
	value: string;
};

export interface EmailTransport {
	send(message: EmailMessage, idempotencyKey: string): Promise<string>;
}

export type EmailFailureReporter = (
	requestId: string,
	operation: string,
	errorName: string,
	statusCode: number | null,
) => void;

export type IntakeEmailResult = {
	applicantEmailId: string;
	adminEmailId: string;
};

export type MailboxConfig = {
	fromAddress: string;
	adminAddress: string;
};

const EMAIL_ADDRESS_PATTERN = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;

function validAddress(value: string): boolean {
	const separator = value.indexOf("@");
	const localPart = value.slice(0, separator);
	return value.length <= 254
		&& localPart.length <= 64
		&& !localPart.startsWith(".")
		&& !localPart.endsWith(".")
		&& !localPart.includes("..")
		&& EMAIL_ADDRESS_PATTERN.test(value);
}

export function parseMailboxConfig(fromAddress: string, adminAddress: string): MailboxConfig | null {
	if (fromAddress !== fromAddress.trim() || adminAddress !== adminAddress.trim()
		|| fromAddress.startsWith('"') || fromAddress.endsWith('"')) return null;
	const displayAddress = fromAddress.match(/^([^<>\r\n]+) <([^<>]+)>$/);
	if (!(validAddress(fromAddress) || displayAddress && validAddress(displayAddress[2] ?? ""))
		|| !validAddress(adminAddress)) return null;
	return { fromAddress, adminAddress };
}

function emailTags(event: string, requestId: string): EmailTag[] {
	return [
		{ name: "application", value: "platinum-gold" },
		{ name: "event", value: event },
		{ name: "request_id", value: requestId },
	];
}

class ResendTransport implements EmailTransport {
	readonly resend: Resend;
	readonly requestId: string;
	readonly reportFailure: EmailFailureReporter;

	constructor(apiKey: string, requestId: string, reportFailure: EmailFailureReporter) {
		this.resend = new Resend(apiKey);
		this.requestId = requestId;
		this.reportFailure = reportFailure;
	}

	async send(message: EmailMessage, idempotencyKey: string): Promise<string> {
		const result = await this.resend.emails.send(message, { idempotencyKey });
		if (result.error) {
			this.reportFailure(
				this.requestId,
				idempotencyKey.split("/", 1)[0] ?? "email",
				result.error.name,
				result.error.statusCode,
			);
			throw new Error("Email delivery failed.");
		}
		if (!result.data) throw new Error("Email delivery failed.");
		return result.data.id;
	}
}

function reportEmailFailure(
	requestId: string,
	operation: string,
	errorName: string,
	statusCode: number | null,
): void {
	console.error("Resend email request failed", { requestId, operation, errorName, statusCode });
}

export function createEmailTransport(
	apiKey: string,
	requestId: string,
	reportFailure: EmailFailureReporter = reportEmailFailure,
): EmailTransport {
	return new ResendTransport(apiKey, requestId, reportFailure);
}

export async function sendIntakeEmails(
	transport: EmailTransport,
	request: ApiKeyRequest,
	requestId: string,
	mailbox: MailboxConfig,
): Promise<IntakeEmailResult> {
	const applicantEmailId = await sendWaitingListEmail(transport, request, requestId, mailbox);
	const adminEmailId = await sendAdminNotificationEmail(transport, request, requestId, mailbox);
	return { applicantEmailId, adminEmailId };
}

export function sendWaitingListEmail(
	transport: EmailTransport,
	request: ApiKeyRequest,
	requestId: string,
	mailbox: MailboxConfig,
): Promise<string> {
	return transport.send({
		from: mailbox.fromAddress,
		to: request.email,
		subject: "Your Platinum Gold API request",
		react: <WaitingListEmail firstName={request.firstName} />,
		tags: emailTags("waiting-list", requestId),
	}, `waiting-list/${requestId}`);
}

export function sendAdminNotificationEmail(
	transport: EmailTransport,
	request: ApiKeyRequest,
	requestId: string,
	mailbox: MailboxConfig,
): Promise<string> {
	return transport.send({
		from: mailbox.fromAddress,
		to: mailbox.adminAddress,
		subject: `API access request from ${request.firstName} ${request.lastName}`,
		react: <AdminRequestEmail request={request} requestId={requestId} />,
		tags: emailTags("admin-notification", requestId),
	}, `admin-notification/${requestId}`);
}

export function sendApprovalEmail(
	transport: EmailTransport,
	email: string,
	firstName: string,
	apiKey: string,
	requestId: string,
	mailbox: MailboxConfig,
): Promise<string> {
	return transport.send({
		from: mailbox.fromAddress,
		to: email,
		subject: "Your Platinum Gold API access",
		react: <ApiKeyApprovedEmail firstName={firstName} apiKey={apiKey} />,
		tags: emailTags("api-key-approved", requestId),
	}, `api-key-approved/${requestId}`);
}

export function sendDenialEmail(
	transport: EmailTransport,
	email: string,
	firstName: string,
	requestId: string,
	mailbox: MailboxConfig,
): Promise<string> {
	return transport.send({
		from: mailbox.fromAddress,
		to: email,
		subject: "Your Platinum Gold API request",
		react: <ApiKeyDeniedEmail firstName={firstName} />,
		tags: emailTags("api-key-denied", requestId),
	}, `api-key-denied/${requestId}`);
}
