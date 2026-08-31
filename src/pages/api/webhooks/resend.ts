import type { APIRoute } from "astro";
import {
	REQUESTS_TURSO_DB,
	REQUESTS_TURSO_TOKEN,
	RESEND_API_KEY,
	RESEND_WEBHOOK_SECRET,
} from "astro:env/server";
import { Resend } from "resend";

import { getRequestsDatabase } from "../../../lib/api-key-requests/database";
import {
	handleResendWebhook,
	type ResendWebhookVerifier,
} from "../../../lib/api-key-requests/resend-webhook";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	if (!REQUESTS_TURSO_DB || !REQUESTS_TURSO_TOKEN
		|| !RESEND_API_KEY || !RESEND_WEBHOOK_SECRET) {
		return new Response(null, { status: 503 });
	}
	const resend = new Resend(RESEND_API_KEY);
	const verify: ResendWebhookVerifier = (payload, id, timestamp, signature, secret) => (
		resend.webhooks.verify({
			payload,
			headers: { id, timestamp, signature },
			webhookSecret: secret,
		})
	);
	try {
		const client = await getRequestsDatabase(REQUESTS_TURSO_DB, REQUESTS_TURSO_TOKEN);
		return await handleResendWebhook(
			request,
			client,
			RESEND_WEBHOOK_SECRET,
			verify,
			new Date().toISOString(),
		);
	} catch {
		return new Response(null, { status: 503 });
	}
};
