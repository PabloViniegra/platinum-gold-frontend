function clamp(value: number): number {
	if (value < 0) {
		return 0;
	}
	if (value > 1) {
		return 1;
	}
	return value;
}

export function mountHeroWall(stage: HTMLElement): () => void {
	const pin = stage.closest("[data-hero-pin]");
	const overlay = stage.querySelector("[data-hero-overlay]");
	const cta = stage.querySelector("a[href='/getting-started']");
	let aimed = false;

	function setSpot(x: number, y: number): void {
		stage.style.setProperty("--spot-x", `${x}%`);
		stage.style.setProperty("--spot-y", `${y}%`);
	}

	function onPointerMove(event: PointerEvent): void {
		if (aimed) {
			return;
		}
		const rect = stage.getBoundingClientRect();
		if (rect.width === 0 || rect.height === 0) {
			return;
		}
		const x = ((event.clientX - rect.left) / rect.width) * 100;
		const y = ((event.clientY - rect.top) / rect.height) * 100;
		setSpot(x, y);
	}

	function aimAtCta(): void {
		if (!(cta instanceof HTMLElement)) {
			return;
		}
		aimed = true;
		const stageRect = stage.getBoundingClientRect();
		const ctaRect = cta.getBoundingClientRect();
		if (stageRect.width === 0 || stageRect.height === 0) {
			return;
		}
		const x =
			((ctaRect.left + ctaRect.width / 2 - stageRect.left) / stageRect.width) *
			100;
		const y =
			((ctaRect.top + ctaRect.height / 2 - stageRect.top) / stageRect.height) *
			100;
		setSpot(x, y);
	}

	function releaseAim(): void {
		aimed = false;
	}

	function onScroll(): void {
		if (!(pin instanceof HTMLElement)) {
			return;
		}
		const span = pin.offsetHeight - window.innerHeight;
		if (span <= 0) {
			stage.style.setProperty("--hero-p", "0");
			return;
		}
		const p = clamp(-pin.getBoundingClientRect().top / span);
		stage.style.setProperty("--hero-p", p.toFixed(4));
		if (overlay instanceof HTMLElement) {
			if (p > 0.4) {
				overlay.setAttribute("inert", "");
			} else {
				overlay.removeAttribute("inert");
			}
		}
	}

	stage.addEventListener("pointermove", onPointerMove);
	window.addEventListener("scroll", onScroll, { passive: true });
	if (cta instanceof HTMLElement) {
		cta.addEventListener("pointerenter", aimAtCta);
		cta.addEventListener("pointerleave", releaseAim);
		cta.addEventListener("focus", aimAtCta);
		cta.addEventListener("blur", releaseAim);
	}
	onScroll();

	return () => {
		stage.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("scroll", onScroll);
		if (cta instanceof HTMLElement) {
			cta.removeEventListener("pointerenter", aimAtCta);
			cta.removeEventListener("pointerleave", releaseAim);
			cta.removeEventListener("focus", aimAtCta);
			cta.removeEventListener("blur", releaseAim);
		}
		stage.style.removeProperty("--spot-x");
		stage.style.removeProperty("--spot-y");
		stage.style.removeProperty("--hero-p");
		if (overlay instanceof HTMLElement) {
			overlay.removeAttribute("inert");
		}
	};
}
