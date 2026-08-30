export function afterNextPaint(task: () => void): () => void {
	let cancelled = false;
	let inner = 0;
	const outer = requestAnimationFrame(() => {
		inner = requestAnimationFrame(() => {
			if (!cancelled) task();
		});
	});
	return () => {
		cancelled = true;
		cancelAnimationFrame(outer);
		cancelAnimationFrame(inner);
	};
}
