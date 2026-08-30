import type { Client, Value } from "@libsql/client";

import {
	normalizeEmail,
	parseApiKeyUseCase,
	type ApiKeyRequest,
	type ApiKeyUseCase,
} from "./contracts";

export type PendingApiKeyRequest = {
	id: string;
	firstName: string;
	lastName: string;
	email: string;
	country: string;
	occupation: string;
	useCase: ApiKeyUseCase;
	useCaseDetails: string | null;
	createdAt: string;
};

export const REQUEST_STATUS = {
	PENDING: "pending",
	APPROVED: "approved",
	DENIED: "denied",
} as const;

export type RequestStatus = (typeof REQUEST_STATUS)[keyof typeof REQUEST_STATUS];

export type StoredApiKeyRequest = {
	id: string;
	status: RequestStatus;
	applicantEmailId: string | null;
	adminEmailId: string | null;
	request: ApiKeyRequest;
};

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
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
	created_at TEXT NOT NULL,
	approved_at TEXT,
	denied_at TEXT,
	applicant_email_id TEXT,
	admin_email_id TEXT,
	approval_email_id TEXT,
	denial_email_id TEXT
)`;

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
	], "write");
	await migrateDeniedStatus(client);
}

async function migrateDeniedStatus(client: Client): Promise<void> {
	const result = await client.execute(
		"SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'api_key_requests'",
	);
	const sql = result.rows[0]?.sql;
	if (sql?.constructor !== String || sql.includes("'denied'")) return;
	await client.batch([
		REQUESTS_TABLE_SQL.replace("CREATE TABLE api_key_requests", "CREATE TABLE api_key_requests_migrated"),
		`INSERT INTO api_key_requests_migrated (
			id, first_name, last_name, email, email_normalized, country, occupation,
			use_case, use_case_details, status, created_at, approved_at,
			applicant_email_id, admin_email_id, approval_email_id
		) SELECT
			id, first_name, last_name, email, email_normalized, country, occupation,
			use_case, use_case_details, status, created_at, approved_at,
			applicant_email_id, admin_email_id, approval_email_id
		FROM api_key_requests`,
		"DROP TABLE api_key_requests",
		"ALTER TABLE api_key_requests_migrated RENAME TO api_key_requests",
		`CREATE INDEX IF NOT EXISTS api_key_requests_pending_created
			ON api_key_requests (status, created_at DESC)`,
	], "write");
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
	if (!row) return null;
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
		id, first_name, last_name, email, country, occupation,
		use_case, use_case_details, created_at
		FROM api_key_requests
		WHERE status = 'pending'
		ORDER BY created_at DESC`);

	return result.rows.map((row) => {
		const useCase = parseApiKeyUseCase(databaseString(row.use_case, "use_case"));
		if (!useCase) throw new Error("Invalid use_case in API key request row.");
		return {
			id: databaseString(row.id, "id"),
			firstName: databaseString(row.first_name, "first_name"),
			lastName: databaseString(row.last_name, "last_name"),
			email: databaseString(row.email, "email"),
			country: databaseString(row.country, "country"),
			occupation: databaseString(row.occupation, "occupation"),
			useCase,
			useCaseDetails: databaseNullableString(row.use_case_details, "use_case_details"),
			createdAt: databaseString(row.created_at, "created_at"),
		};
	});
}

export async function findPendingRequestById(
	client: Client,
	id: string,
): Promise<PendingApiKeyRequest | null> {
	const result = await client.execute({
		sql: `SELECT id, first_name, last_name, email, country, occupation,
			use_case, use_case_details, created_at
			FROM api_key_requests WHERE id = ? AND status = 'pending'`,
		args: [id],
	});
	const row = result.rows[0];
	if (!row) return null;
	const useCase = parseApiKeyUseCase(databaseString(row.use_case, "use_case"));
	if (!useCase) throw new Error("Invalid use_case in API key request row.");
	return {
		id: databaseString(row.id, "id"),
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

export async function markRequestApproved(
	client: Client,
	id: string,
	approvalEmailId: string,
	approvedAt: string,
): Promise<boolean> {
	const result = await client.execute({
		sql: `UPDATE api_key_requests
			SET status = 'approved', approval_email_id = ?, approved_at = ?
			WHERE id = ? AND status = 'pending'`,
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
			SET status = 'denied', denial_email_id = ?, denied_at = ?
			WHERE id = ? AND status = 'pending'`,
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
	const result = await client.execute({
		sql: `INSERT INTO request_rate_limits (
			action, identifier_hash, window_start, request_count
		) VALUES (?, ?, ?, 1)
		ON CONFLICT(action, identifier_hash, window_start)
		DO UPDATE SET request_count = request_count + 1
		RETURNING request_count`,
		args: [action, identifierHash, windowStart],
	});
	const count = Number(result.rows[0]?.request_count);
	return Number.isSafeInteger(count) && count <= limit;
}
