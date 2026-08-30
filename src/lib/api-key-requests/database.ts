import { createClient, type Client } from "@libsql/client";

import { initializeRequestsSchema } from "./repository";

let requestsDatabase: Client | null = null;
let schemaInitialization: Promise<void> | null = null;

export function createRequestsDatabase(databaseUrl: string, authToken: string): Client {
	return createClient({ url: databaseUrl, authToken });
}

export async function getRequestsDatabase(databaseUrl: string, authToken: string): Promise<Client> {
	try {
		requestsDatabase ??= createRequestsDatabase(databaseUrl, authToken);
		schemaInitialization ??= initializeRequestsSchema(requestsDatabase);
		await schemaInitialization;
		return requestsDatabase;
	} catch {
		requestsDatabase = null;
		schemaInitialization = null;
		throw new Error("Request database is unavailable.");
	}
}
