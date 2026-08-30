import { randomBytes, scryptSync } from "node:crypto";

const password = process.env.REQUESTS_ADMIN_PASSWORD;

if (!password || password.length < 12) {
	console.error("REQUESTS_ADMIN_PASSWORD must contain at least 12 characters.");
	process.exitCode = 1;
} else {
	const salt = randomBytes(16).toString("base64url");
	const hash = scryptSync(password, salt, 64).toString("base64url");
	process.stdout.write(`scrypt:${salt}:${hash}\n`);
}
