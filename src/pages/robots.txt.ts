import type { APIRoute } from "astro";

import { robotsTxt } from "../lib/seo";

export const GET: APIRoute = ({ site }) => {
	const sitemapHref = site ? new URL("sitemap-index.xml", site).href : "";
	return new Response(robotsTxt(sitemapHref), {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
};
