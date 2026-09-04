// @ts-check
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

const nonIndexablePaths = new Set(['/privacy', '/terms', '/legal', '/cookies', '/licenses']);

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  site: 'https://platinum-gold-frontend.vercel.app',
  trailingSlash: 'never',
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const path = new URL(page).pathname;
        const documentPath = path.startsWith('/es/') ? path.slice(3) : path;
        return !nonIndexablePaths.has(documentPath)
          && path !== '/admin'
          && !path.startsWith('/admin/')
          && path !== '/api'
          && !path.startsWith('/api/');
      },
    }),
  ],
  env: {
			schema: {
				PLATINUM_BACKEND_API_KEY: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				RESEND_API_KEY: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				RESEND_WEBHOOK_SECRET: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_TURSO_DB: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_PUBLIC_ENABLED: envField.boolean({
					context: 'server',
					access: 'secret',
					default: false
				}),
				REQUESTS_TURSO_TOKEN: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_ADMIN_PATH: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_ADMIN_USERNAME: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_ADMIN_PASSWORD_HASH: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_SESSION_SECRET: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_FROM_ADDRESS: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				}),
				REQUESTS_ADMIN_EMAIL: envField.string({
					context: 'server',
					access: 'secret',
					optional: true
				})
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
