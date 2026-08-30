import { existsSync, readFileSync, writeFileSync } from "node:fs";

const configPath = new URL("../.vercel/output/config.json", import.meta.url);
const cacheControl = "public, max-age=86400, stale-while-revalidate=604800";
const extraRoutes = [
	{
		src: "^/fonts/(.*)$",
		headers: { "cache-control": cacheControl },
		continue: true,
	},
	{
		src: "^/(tboi-wall|tboi-wall-lg|wall2)\\.webp$",
		headers: { "cache-control": cacheControl },
		continue: true,
	},
];

if (!existsSync(configPath)) {
	process.exit(0);
}

const config = JSON.parse(readFileSync(configPath, "utf8"));
const routes = Array.isArray(config.routes) ? config.routes : [];
if (routes.some((route) => route.src === extraRoutes[0].src)) {
	process.exit(0);
}

const filesystemIndex = routes.findIndex((route) => route.handle === "filesystem");
const insertAt = filesystemIndex === -1 ? 0 : filesystemIndex;
config.routes = [...routes.slice(0, insertAt), ...extraRoutes, ...routes.slice(insertAt)];
writeFileSync(configPath, `${JSON.stringify(config, null, "\t")}\n`);
