import { afterEach, describe, expect, it, vi } from "vitest";

import { afterNextPaint } from "./after-next-paint";

describe("afterNextPaint", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("does not run the task until two animation frames have fired", () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback);
			return frames.length;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {});

		let ran = false;
		afterNextPaint(() => {
			ran = true;
		});

		expect(ran).toBe(false);
		frames[0](0);
		expect(ran).toBe(false);
		frames[1](0);
		expect(ran).toBe(true);
	});

	it("does not run the task after cancel", () => {
		const frames: FrameRequestCallback[] = [];
		vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
			frames.push(callback);
			return frames.length;
		});
		vi.stubGlobal("cancelAnimationFrame", () => {});

		let ran = false;
		const cancel = afterNextPaint(() => {
			ran = true;
		});
		cancel();
		for (const frame of frames) {
			frame(0);
		}

		expect(ran).toBe(false);
	});
});
