import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import oxlintConfig from "../../../oxlint.config";
import antiSlopPlugin from "./index";

type OxlintDiagnostic = {
	code: string;
};

type OxlintOutput = {
	diagnostics: OxlintDiagnostic[];
};

const directories: string[] = [];

function lintCodes(source: string, extension = "ts"): string[] {
	const directory = mkdtempSync(join(tmpdir(), "anti-slop-"));
	directories.push(directory);
	const fixture = join(directory, `fixture.${extension}`);
	writeFileSync(fixture, source);
	const result = spawnSync(process.execPath, [
		resolve("node_modules/oxlint/bin/oxlint"),
		"--config",
		resolve("oxlint.config.ts"),
		"--format",
		"json",
		fixture,
	], { cwd: resolve("."), encoding: "utf8" });
	const output: OxlintOutput = JSON.parse(result.stdout);
	return output.diagnostics
		.map((diagnostic) => diagnostic.code.replace(/^([^()]+)\(([^)]+)\)$/u, "$1/$2"))
		.filter((code) => code.startsWith("anti-slop/"));
}

afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe("anti-slop plugin", () => {
	it("enables every exported rule as an error", () => {
		const exportedRules = Object.keys(antiSlopPlugin.rules ?? {}).sort();
		const configuredRules = Object.entries(oxlintConfig.rules ?? {})
			.filter(([name, severity]) => name.startsWith("anti-slop/") && severity === "error")
			.map(([name]) => name.replace("anti-slop/", ""))
			.sort();

		expect(configuredRules).toEqual(exportedRules);
	});

	it("distinguishes closed records and picks from open dictionaries", () => {
		expect(lintCodes(`
			const exact: Record<"id", 1> = { id: 1 };
			type Fixed = Pick<Record<string, unknown>, "fixed">;
		`)).toEqual([]);
	});

	it("checks dictionaries retained inside a picked property", () => {
		expect(lintCodes(`
			type Hidden = Pick<{ fixed: Record<string, unknown> }, "fixed">;
		`)).toContain("anti-slop/no-unsafe-dictionary-type");
	});

	it("resolves type namespaces, generic aliases, and unknown unions", () => {
		const codes = lintCodes(`
			function Record() {}
			type Identity<T> = T;
			type Hidden = string | unknown;
			function consume(value: Identity<unknown>) {}
			function consumeObject(value: Identity<object>) {}
			const values: Record<string, unknown> = {};
		`);

		expect(codes).toContain("anti-slop/no-unknown-type-aliases");
		expect(codes).toContain("anti-slop/no-unknown-parameters");
		expect(codes).toContain("anti-slop/no-object-parameters");
		expect(codes).toContain("anti-slop/no-unsafe-dictionary-type");
	});

	it("does not assign global Promise semantics to a local alias", () => {
		expect(lintCodes(`
			type Promise<T> = { value: T };
			function load(): Promise<unknown> { return { value: 1 }; }
		`)).not.toContain("anti-slop/no-unknown-returns");
	});

	it("does not assign global Record semantics to a local alias", () => {
		expect(lintCodes(`
			type Record<K, V> = { value: V };
			const source = { value: 1 };
			const broad: Record<string, unknown> = source;
			const exact = broad as Record<"id", 1>;
		`)).not.toContain("anti-slop/no-widen-then-assert");
	});

	it("handles merged empty interfaces and transparent expression wrappers", () => {
		const codes = lintCodes(`
			interface Empty {}
			interface Empty {}
			const values: Record<string, Empty> = {};
			declare const value: string;
			const asserted = ((value as unknown)!) as string;
		`);

		expect(codes).toContain("anti-slop/no-unsafe-dictionary-type");
		expect(codes).toContain("anti-slop/no-chained-type-assertions");
	});

	it("recognizes qualified Reflect calls and Vitest namespace mocks", () => {
		const codes = lintCodes(`
			import * as vitest from "vitest";
			globalThis.Reflect.get({}, "id");
			vitest.vi.mock("./dependency");
		`);

		expect(codes).toContain("anti-slop/no-reflect-get");
		expect(codes).toContain("anti-slop/no-module-mocking");
	});

});
