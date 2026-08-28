type ProxyErrorBody = {
	error: {
		message: string;
	};
};

function isString(value: string): boolean {
	return value?.constructor === String;
}

function isProxyErrorBody(body: ProxyErrorBody): boolean {
	return body !== null && body.error !== null && isString(body.error.message);
}

function messageFromBody(body: string): string | null {
	try {
		const parsed: ProxyErrorBody = JSON.parse(body);
		if (isProxyErrorBody(parsed)) {
			return parsed.error.message;
		}
	} catch {
		return null;
	}
	return null;
}

export function proxyErrorMessage(body: string, status: number): string {
	const message = messageFromBody(body);
	if (message) {
		return message;
	}
	if (status === 503) {
		return "The item example is not configured yet.";
	}
	if (status === 400) {
		return "Check the selected filters and try again.";
	}
	return "Items could not be loaded. Try again shortly.";
}

export function isRetryableProxyStatus(status: number): boolean {
	return status === 502 || status === 504;
}

export function proxyStatusForUpstream(upstreamStatus: number): number {
	if (upstreamStatus === 401 || upstreamStatus === 403) {
		return 503;
	}
	return 502;
}
