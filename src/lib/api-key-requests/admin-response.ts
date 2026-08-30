export function adminHeaders(): Headers {
	return new Headers({
		"Cache-Control": "no-store",
		"Referrer-Policy": "no-referrer",
		"X-Content-Type-Options": "nosniff",
		"X-Frame-Options": "DENY",
	});
}

export function adminJsonResponse(message: string, status: number): Response {
	return Response.json({ message }, { status, headers: adminHeaders() });
}

export function adminEmptyResponse(status: number, cookie?: string): Response {
	const headers = adminHeaders();
	if (cookie !== undefined) headers.set("Set-Cookie", cookie);
	return new Response(null, { status, headers });
}
