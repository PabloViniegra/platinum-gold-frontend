import type { Client } from "@libsql/client";

import { handleAdminLogin } from "./admin-session";
import { adminJsonResponse } from "./admin-response";

export type AdminSessionRouteConfig = {
	username: string;
	passwordHash: string;
	sessionSecret: string;
	databaseUrl: string;
	databaseToken: string;
};

export type RequestsDatabaseFactory = (databaseUrl: string, databaseToken: string) => Promise<Client>;

export async function handleAdminSessionPost(
	request: Request,
	clientAddress: string,
	nowMilliseconds: number,
	config: AdminSessionRouteConfig,
	databaseFactory: RequestsDatabaseFactory,
): Promise<Response> {
	try {
		const client = await databaseFactory(config.databaseUrl, config.databaseToken);
		return handleAdminLogin(request, client, {
			username: config.username,
			passwordHash: config.passwordHash,
			sessionSecret: config.sessionSecret,
		}, clientAddress, nowMilliseconds);
	} catch {
		return adminJsonResponse("Administration is unavailable.", 503);
	}
}
