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
      })
    }
  },
  vite: {
    plugins: [tailwindcss()]
  }
});
