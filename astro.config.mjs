// @ts-check
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  adapter: vercel(),
  integrations: [react()],
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
