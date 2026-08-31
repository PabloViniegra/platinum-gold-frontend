import type { Client, Value } from "@libsql/client";

import {
	normalizeEmail,
	parseApiKeyUseCase,
	type ApiKeyRequest,
	type ApiKeyUseCase,
} from "./contracts";

export const REQUEST_STATUS = {
	PENDING: "pending",
	APPROVING: "approving",
	DENYING: "denying",
	APPROVED: "approved",
	DENIED: "denied",
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export type ActionableRequestStatus = typeof REQUEST_STATUS.PENDING
	| typeof REQUEST_STATUS.APPROVING
	| typeof REQUEST_STATUS.DENYING;

export type ActionableApiKeyRequest = {
	id: string;
	status: ActionableRequestStatus;
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: ApiKeyUseCase;
	useCaseDetails: string | null;
	createdAt: string;
};

export type PendingApiKeyRequest = ActionableApiKeyRequest & {
	applicantEmailAccepted: boolean;
	applicantEmailStatus: EmailDeliveryStatus | null;
	adminEmailAccepted: boolean;
	adminEmailStatus: EmailDeliveryStatus | null;
};

export type StoredApiKeyRequest = {
	id: string;
	status: RequestStatus;
	applicantEmailId: string | null;
	adminEmailId: string | null;
	request: ApiKeyRequest;
};

export const EMAIL_DELIVERY_STATUS = {
	SENT: "sent",
	DELIVERED: "delivered",
	DELAYED: "delivery_delayed",
	COMPLAINED: "complained",
	BOUNCED: "bounced",
	FAILED: "failed",
	SUPPRESSED: "suppressed",
} as const;

export type EmailDeliveryStatus = (
	typeof EMAIL_DELIVERY_STATUS
)[keyof typeof EMAIL_DELIVERY_STATUS];

function databaseEmailDeliveryStatus(value: Value, field: string): EmailDeliveryStatus | null {
	if (value === null) return null;
	const status = databaseString(value, field);
	for (const knownStatus of Object.values(EMAIL_DELIVERY_STATUS)) {
		if (status === knownStatus) return knownStatus;
	}
	throw new Error(`Invalid ${field} row.`);
}

function databaseString(value: Value, field: string): string {
	if (value?.constructor !== String) throw new Error(`Invalid ${field} in API key request row.`);
	return value.toString();
}

function databaseNullableString(value: Value, field: string): string | null {
	return value === null ? null : databaseString(value, field);
}

function parseRequestStatus(value: string): RequestStatus | null {
	switch (value) {
		case REQUEST_STATUS.PENDING:
			return REQUEST_STATUS.PENDING;
		case REQUEST_STATUS.APPROVING:
			return REQUEST_STATUS.APPROVING;
		case REQUEST_STATUS.DENYING:
			return REQUEST_STATUS.DENYING;
		case REQUEST_STATUS.APPROVED:
			return REQUEST_STATUS.APPROVED;
		case REQUEST_STATUS.DENIED:
			return REQUEST_STATUS.DENIED;
		default:
			return null;
	}
}

const REQUESTS_TABLE_SQL = `CREATE TABLE api_key_requests (
	id TEXT PRIMARY KEY,
	first_name TEXT NOT NULL,
	last_name TEXT NOT NULL,
	email TEXT NOT NULL,
	email_normalized TEXT NOT NULL UNIQUE,
	country TEXT NOT NULL,
	occupation TEXT NOT NULL,
	use_case TEXT NOT NULL,
	use_case_details TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approving', 'denying', 'approved', 'denied')),
	created_at TEXT NOT NULL,
	approved_at TEXT,
	denied_at TEXT,
	applicant_email_id TEXT,
	admin_email_id TEXT,
	approval_email_id TEXT,
	denial_email_id TEXT,
	decision_fingerprint TEXT,
	decision_owner TEXT,
	decision_claimed_at INTEGER NOT NULL DEFAULT 0
)`;

const REQUEST_TABLE_COLUMNS = [
	"id", "first_name", "last_name", "email", "email_normalized", "country",
	"occupation", "use_case", "use_case_details", "status", "created_at",
	"approved_at", "denied_at", "applicant_email_id", "admin_email_id",
	"approval_email_id", "denial_email_id", "decision_fingerprint",
	"decision_owner", "decision_claimed_at",
] as const;

export const DECISION_LEASE_MILLISECONDS = 10 * 60 * 1_000;

export async function initializeRequestsSchema(client: Client): Promise<void> {
	await client.batch([
		REQUESTS_TABLE_SQL.replace("CREATE TABLE api_key_requests", "CREATE TABLE IF NOT EXISTS api_key_requests"),
		`CREATE INDEX IF NOT EXISTS api_key_requests_pending_created
			ON api_key_requests (status, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS request_rate_limits (
			action TEXT NOT NULL,
			identifier_hash TEXT NOT NULL,
			window_start INTEGER NOT NULL,
			request_count INTEGER NOT NULL,
			PRIMARY KEY (action, identifier_hash, window_start)
		)`,
		`CREATE INDEX IF NOT EXISTS request_rate_limits_action_window
			ON request_rate_limits (action, window_start)`,
		`CREATE TABLE IF NOT EXISTS request_email_delivery_statuses (
			email_id TEXT PRIMARY KEY,
			status TEXT NOT NULL CHECK (status IN (
				'sent', 'delivered', 'delivery_delayed', 'complained',
				'bounced', 'failed', 'suppressed'
			)),
			event_created_at INTEGER NOT NULL,
			recorded_at TEXT NOT NULL
		)`,
	], "write");
	await migrateRequestsTable(client, "'denied'");
	await migrateRequestsTable(client, "'approving'");
}

async function migrateRequestsTable(client: Client, requiredToken: string): Promise<void> {
	const sql = await requestsTableSql(client);
	if (sql === null || sql.includes(requiredToken)) return;
	const legacyColumns = await requestsTableColumns(client);
	const shared = REQUEST_TABLE_COLUMNS.filter((column) => legacyColumns.has(column));
	const columnList = shared.join(", ");
	try {
		await client.batch([
			REQUESTS_TABLE_SQL.replace("CREATE TABLE api_key_requests", "CREATE TABLE api_key_requests_migrated"),
			`INSERT INTO api_key_requests_migrated (${columnList})
			 SELECT ${columnList} FROM api_key_requests`,
			"DROP TABLE api_key_requests",
			"ALTER TABLE api_key_requests_migrated RENAME TO api_key_requests",
			`CREATE INDEX IF NOT EXISTS api_key_requests_pending_created
				ON api_key_requests (status, created_at DESC)`,
		], "write");
	} catch {
		if ((await requestsTableSql(client))?.includes(requiredToken)) return;
		throw new Error("API key request table migration failed.");
	}
}

async function requestsTableSql(client: Client): Promise<string | null> {
	const result = await client.execute(
		"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'api_key_requests'",
	);
	const sql = result.rows[0]?.sql;
	return sql?.constructor === String ? sql.toString() : null;
}

async function requestsTableColumns(client: Client): Promise<Set<string>> {
	const result = await client.execute("PRAGMA table_info(api_key_requests)");
	return new Set(result.rows.map((row) => databaseString(row.name, "column_name")));
}

export async function createPendingRequest(
	client: Client,
	request: ApiKeyRequest,
	id: string,
	createdAt: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `INSERT INTO api_key_requests (
			id, first_name, last_name, email, email_normalized, country,
			occupation, use_case, use_case_details, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(email_normalized) DO NOTHING`,
		args: [
			id,
			request.firstName,
			request.lastName,
			request.email,
			normalizeEmail(request.email),
			request.country,
			request.occupation,
			request.useCase,
			request.useCaseDetails,
			createdAt,
		],
	});
	return result.rowsAffected === 1;
}

export async function recordApplicantDelivery(
	client: Client,
	id: string,
	applicantEmailId: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `UPDATE api_key_requests
			SET applicant_email_id = ?
			WHERE id = ? AND status = 'pending'`,
		args: [applicantEmailId, id],
	});
	return result.rowsAffected === 1;
}

export async function recordAdminDelivery(
	client: Client,
	id: string,
	adminEmailId: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `UPDATE api_key_requests
			SET admin_email_id = ?
			WHERE id = ? AND status = 'pending'`,
		args: [adminEmailId, id],
	});
	return result.rowsAffected === 1;
}

export async function recordEmailDeliveryEvent(
	client: Client,
	emailId: string,
	status: EmailDeliveryStatus,
	eventCreatedAtMilliseconds: number,
	recordedAt: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `INSERT INTO request_email_delivery_statuses (
			email_id, status, event_created_at, recorded_at
		) VALUES (?, ?, ?, ?)
		ON CONFLICT(email_id) DO UPDATE SET
			status = excluded.status,
			event_created_at = excluded.event_created_at,
			recorded_at = excluded.recorded_at
		WHERE excluded.event_created_at > request_email_delivery_statuses.event_created_at`,
		args: [emailId, status, eventCreatedAtMilliseconds, recordedAt],
	});
	return result.rowsAffected === 1;
}

export async function findEmailDeliveryStatus(
	client: Client,
	emailId: string,
): Promise<EmailDeliveryStatus | null> {
	const result = await client.execute({
		sql: "SELECT status FROM request_email_delivery_statuses WHERE email_id = ?",
		args: [emailId],
	});
	const value = result.rows[0]?.status;
	if (value === undefined) return null;
	return databaseEmailDeliveryStatus(value, "email_delivery_status");
}

export async function findStoredRequest(
	client: Client,
	email: string,
): Promise<StoredApiKeyRequest | null> {
	const result = await client.execute({
		sql: `SELECT id, status, applicant_email_id, admin_email_id, first_name, last_name,
			email, country, occupation, use_case, use_case_details
			FROM api_key_requests WHERE email_normalized = ?`,
		args: [normalizeEmail(email)],
	});
	const row = result.rows[0];
	return row ? storedRequestFromRow(row) : null;
}

export async function findStoredRequestById(
	client: Client,
	id: string,
): Promise<StoredApiKeyRequest | null> {
	const result = await client.execute({
		sql: `SELECT id, status, applicant_email_id, admin_email_id, first_name, last_name,
			email, country, occupation, use_case, use_case_details
			FROM api_key_requests WHERE id = ?`,
		args: [id],
	});
	const row = result.rows[0];
	return row ? storedRequestFromRow(row) : null;
}

function storedRequestFromRow(row: Readonly<Record<string, Value>>): StoredApiKeyRequest {
	const statusValue = parseRequestStatus(databaseString(row.status, "status"));
	if (!statusValue) {
		throw new Error("Invalid status in API key request row.");
	}
	const useCase = parseApiKeyUseCase(databaseString(row.use_case, "use_case"));
	if (!useCase) throw new Error("Invalid use_case in API key request row.");
	return {
		id: databaseString(row.id, "id"),
		status: statusValue,
		applicantEmailId: databaseNullableString(row.applicant_email_id, "applicant_email_id"),
		adminEmailId: databaseNullableString(row.admin_email_id, "admin_email_id"),
		request: {
			firstName: databaseString(row.first_name, "first_name"),
			lastName: databaseString(row.last_name, "last_name"),
			email: databaseString(row.email, "email"),
			country: databaseString(row.country, "country"),
			occupation: databaseString(row.occupation, "occupation"),
			useCase,
			useCaseDetails: databaseNullableString(row.use_case_details, "use_case_details"),
			honeypotTriggered: false,
		},
	};
}

export async function listPendingRequests(client: Client): Promise<PendingApiKeyRequest[]> {
	const result = await client.execute(`SELECT
		requests.id, requests.status, requests.first_name, requests.last_name,
		requests.email, requests.country, requests.occupation, requests.use_case,
		requests.use_case_details, requests.created_at, requests.applicant_email_id,
		requests.admin_email_id, applicant_delivery.status AS applicant_delivery_status,
		admin_delivery.status AS admin_delivery_status
		FROM api_key_requests AS requests
		LEFT JOIN request_email_delivery_statuses AS applicant_delivery
			ON applicant_delivery.email_id = requests.applicant_email_id
		LEFT JOIN request_email_delivery_statuses AS admin_delivery
			ON admin_delivery.email_id = requests.admin_email_id
		WHERE requests.status IN ('pending', 'approving', 'denying')
		ORDER BY requests.created_at DESC`);

	return result.rows.map((row) => {
		const useCase = parseApiKeyUseCase(databaseString(row.use_case, "use_case"));
		if (!useCase) throw new Error("Invalid use_case in API key request row.");
		return {
			id: databaseString(row.id, "id"),
			status: actionableRequestStatus(databaseString(row.status, "status")),
			firstName: databaseString(row.first_name, "first_name"),
			lastName: databaseString(row.last_name, "last_name"),
			email: databaseString(row.email, "email"),
			country: databaseString(row.country, "country"),
			occupation: databaseString(row.occupation, "occupation"),
			useCase,
			useCaseDetails: databaseNullableString(row.use_case_details, "use_case_details"),
			createdAt: databaseString(row.created_at, "created_at"),
			applicantEmailAccepted: row.applicant_email_id !== null,
			applicantEmailStatus: databaseEmailDeliveryStatus(
				row.applicant_delivery_status, "applicant_delivery_status",
			),
			adminEmailAccepted: row.admin_email_id !== null,
			adminEmailStatus: databaseEmailDeliveryStatus(
				row.admin_delivery_status, "admin_delivery_status",
			),
		};
	});
}

export async function beginRequestDecision(
	client: Client,
	id: string,
	decision: typeof REQUEST_STATUS.APPROVING | typeof REQUEST_STATUS.DENYING,
	fingerprint: string | null,
	owner: string,
	nowMilliseconds: number,
): Promise<ActionableApiKeyRequest | null> {
	const claimed = await client.execute({
		sql: `UPDATE api_key_requests
			SET status = ?, decision_fingerprint = ?, decision_owner = ?, decision_claimed_at = ?
			WHERE id = ? AND (
				status = 'pending'
				OR (status = ? AND decision_fingerprint IS ?
					AND (decision_owner IS NULL OR decision_claimed_at <= ?))
			)
			RETURNING id, status, first_name, last_name, email, country, occupation,
				use_case, use_case_details, created_at`,
		args: [
			decision,
			fingerprint,
			owner,
			nowMilliseconds,
			id,
			decision,
			fingerprint,
			nowMilliseconds - DECISION_LEASE_MILLISECONDS,
		],
	});
	const row = claimed.rows[0];
	return row ? pendingRequestFromRow(row) : null;
}

export async function releaseRequestDecision(
	client: Client,
	id: string,
	decision: typeof REQUEST_STATUS.APPROVING | typeof REQUEST_STATUS.DENYING,
	owner: string,
): Promise<void> {
	await client.execute({
		sql: `UPDATE api_key_requests
			SET decision_owner = NULL, decision_claimed_at = 0
			WHERE id = ? AND status = ? AND decision_owner = ?`,
		args: [id, decision, owner],
	});
}

function pendingRequestFromRow(row: Readonly<Record<string, Value>>): ActionableApiKeyRequest {
	const useCase = parseApiKeyUseCase(databaseString(row.use_case, "use_case"));
	if (!useCase) throw new Error("Invalid use_case in API key request row.");
	return {
		id: databaseString(row.id, "id"),
		status: actionableRequestStatus(databaseString(row.status, "status")),
		firstName: databaseString(row.first_name, "first_name"),
		lastName: databaseString(row.last_name, "last_name"),
		email: databaseString(row.email, "email"),
		country: databaseString(row.country, "country"),
		occupation: databaseString(row.occupation, "occupation"),
		useCase,
		useCaseDetails: databaseNullableString(row.use_case_details, "use_case_details"),
		createdAt: databaseString(row.created_at, "created_at"),
	};
}

function actionableRequestStatus(value: string): ActionableRequestStatus {
	if (value === REQUEST_STATUS.PENDING || value === REQUEST_STATUS.APPROVING ||
		value === REQUEST_STATUS.DENYING) return value;
	throw new Error("Invalid actionable status in API key request row.");
}

export async function markRequestApproved(
	client: Client,
	id: string,
	approvalEmailId: string,
	approvedAt: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `UPDATE api_key_requests
			SET status = 'approved', approval_email_id = ?, approved_at = ?,
				decision_fingerprint = NULL, decision_owner = NULL, decision_claimed_at = 0
			WHERE id = ? AND status = 'approving'`,
		args: [approvalEmailId, approvedAt, id],
	});
	return result.rowsAffected === 1;
}

export async function markRequestDenied(
	client: Client,
	id: string,
	denialEmailId: string,
	deniedAt: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `UPDATE api_key_requests
			SET status = 'denied', denial_email_id = ?, denied_at = ?,
				decision_fingerprint = NULL, decision_owner = NULL, decision_claimed_at = 0
			WHERE id = ? AND status = 'denying'`,
		args: [denialEmailId, deniedAt, id],
	});
	return result.rowsAffected === 1;
}

export async function consumeRateLimit(
	client: Client,
	action: string,
	identifierHash: string,
	limit: number,
	windowMilliseconds: number,
	nowMilliseconds: number,
): Promise<boolean> {
	const windowStart = Math.floor(nowMilliseconds / windowMilliseconds) * windowMilliseconds;
	const results = await client.batch([{
		sql: "DELETE FROM request_rate_limits WHERE action = ? AND window_start < ?",
		args: [action, windowStart],
	}, {
		sql: `INSERT INTO request_rate_limits (
			action, identifier_hash, window_start, request_count
		) VALUES (?, ?, ?, 1)
		ON CONFLICT(action, identifier_hash, window_start)
		DO UPDATE SET request_count = request_count + 1
		RETURNING request_count`,
		args: [action, identifierHash, windowStart],
	}], "write");
	const result = results[1];
	const count = Number(result.rows[0]?.request_count);
	return Number.isSafeInteger(count) && count <= limit;
}
