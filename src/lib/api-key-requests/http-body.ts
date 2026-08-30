export async function readBoundedBody(
	message: Request | Response,
	maximumBytes: number,
): Promise<string | null> {
	const declaredLength = Number(message.headers.get("Content-Length") ?? 0);
	if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) return null;
	const stream = message.body;
	if (!stream) return "";
	const reader = stream.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const result = await reader.read();
		if (result.done) break;
		size += result.value.byteLength;
		if (size > maximumBytes) {
			await reader.cancel();
			return null;
		}
		chunks.push(result.value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return new TextDecoder().decode(bytes);
}
