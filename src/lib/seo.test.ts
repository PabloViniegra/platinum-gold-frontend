import { describe, expect, it } from "vitest";

import { canonicalPageUrl, pageJsonLd, robotsTxt } from "./seo";

describe("canonicalPageUrl", () => {
	it("builds a root URL without a trailing path", () => {
		expect(canonicalPageUrl("https://example.com", "/")).toBe("https://example.com/");
	});

	it("strips trailing slashes from inner paths", () => {
		expect(canonicalPageUrl("https://example.com/", "/getting-started/")).toBe(
			"https://example.com/getting-started",
		);
	});

	it("ignores a trailing slash on the site origin", () => {
		expect(canonicalPageUrl("https://example.com/", "/items")).toBe("https://example.com/items");
	});
});

describe("robotsTxt", () => {
	it("allows the site and blocks API and admin paths", () => {
		expect(robotsTxt("https://example.com/sitemap-index.xml")).toBe(
			[
				"User-agent: *",
				"Allow: /",
				"Disallow: /api/",
				"Disallow: /admin/",
				"",
				"Sitemap: https://example.com/sitemap-index.xml",
				"",
			].join("\n"),
		);
	});

	it("omits the sitemap line when no sitemap URL is given", () => {
		expect(robotsTxt("")).toBe(
			["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /admin/", ""].join("\n"),
		);
	});
});

describe("pageJsonLd", () => {
	it("describes the home page as a WebSite and WebPage", () => {
		expect(
			JSON.parse(
				pageJsonLd(
					"https://example.com",
					"https://example.com/",
					"Platinum Gold",
					"Make the first Binding of Isaac item API call without leaking the key.",
					"Platinum Gold",
				),
			),
		).toMatchObject({
			"@context": "https://schema.org",
			"@graph": [{ "@type": "WebSite", url: "https://example.com/" }, { "@type": "WebPage" }],
		});
	});

	it("adds a breadcrumb on inner pages", () => {
		expect(
			JSON.parse(
				pageJsonLd(
					"https://example.com",
					"https://example.com/getting-started",
					"Getting started — Platinum Gold",
					"Authenticate, make one GET, and keep the API key off the public bundle.",
					"Getting started",
				),
			),
		).toMatchObject({
			"@graph": [
				{ "@type": "WebSite" },
				{ "@type": "WebPage" },
				{
					"@type": "BreadcrumbList",
					itemListElement: [
						{ "@type": "ListItem", position: 1, name: "Platinum Gold" },
						{ "@type": "ListItem", position: 2, name: "Getting started" },
					],
				},
			],
		});
	});
});
