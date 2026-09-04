export function canonicalPageUrl(siteHref: string, pathname: string): string {
	const path = pathname.replace(/\/+$/, "") || "/";
	return new URL(path, siteHref).href;
}

export function robotsTxt(sitemapHref: string): string {
	const lines = ["User-agent: *", "Allow: /", "Disallow: /api/", "Disallow: /admin/"];
	if (sitemapHref !== "") {
		lines.push("", `Sitemap: ${sitemapHref}`);
	}
	return `${lines.join("\n")}\n`;
}

export function pageJsonLd(
	siteHref: string,
	pageUrl: string,
	title: string,
	description: string,
	crumbName: string,
): string {
	const homeUrl = new URL("/", siteHref).href;
	const websiteId = `${homeUrl}#website`;
	const website = {
		"@type": "WebSite",
		"@id": websiteId,
		name: "Platinum Gold",
		url: homeUrl,
		description: "Read-only Binding of Isaac item API documentation for frontend developers.",
		inLanguage: "en",
	};
	const webPage = {
		"@type": "WebPage",
		"@id": `${pageUrl}#webpage`,
		url: pageUrl,
		name: title,
		description,
		inLanguage: "en",
		isPartOf: { "@id": websiteId },
	};
	if (pageUrl === homeUrl) {
		return JSON.stringify({
			"@context": "https://schema.org",
			"@graph": [website, webPage],
		});
	}
	return JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			website,
			webPage,
			{
				"@type": "BreadcrumbList",
				itemListElement: [
					{
						"@type": "ListItem",
						position: 1,
						name: "Platinum Gold",
						item: homeUrl,
					},
					{
						"@type": "ListItem",
						position: 2,
						name: crumbName,
						item: pageUrl,
					},
				],
			},
		],
	});
}
