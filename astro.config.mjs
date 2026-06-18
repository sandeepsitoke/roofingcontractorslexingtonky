// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://roofingcontractorslexingtonky.com',
  integrations: [
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
    mdx(),
  ],
  build: {
    inlineStylesheets: 'always',
  },
  compressHTML: true,
  prefetch: false,
});
