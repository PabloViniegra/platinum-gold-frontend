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
};

export interface EmailTransport {
	send(message: EmailMessage, idempotencyKey: string): Promise<string>;
}

export type IntakeEmailResult = {
	applicantEmailId: string;
	adminEmailId: string;
};

export type MailboxConfig = {
	fromAddress: string;
	adminAddress: string;
};

class ResendTransport implements EmailTransport {
	readonly resend: Resend;

	constructor(apiKey: string) {
		this.resend = new Resend(apiKey);
	}

	async send(message: EmailMessage, idempotencyKey: string): Promise<string> {
		const result = await this.resend.emails.send(message, { idempotencyKey });
		if (result.error || !result.data) throw new Error("Email delivery failed.");
		return result.data.id;
	}
}

export function createEmailTransport(apiKey: string): EmailTransport {
	return new ResendTransport(apiKey);
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
	}, `api-key-denied/${requestId}`);
}
