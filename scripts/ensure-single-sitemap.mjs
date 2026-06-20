import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const distDir = join(process.cwd(), 'dist');
const allowedSitemap = 'sitemap-0.xml';
const generatedIndex = join(distDir, 'sitemap-index.xml');

if (existsSync(generatedIndex)) {
  rmSync(generatedIndex);
}

const sitemapFiles = readdirSync(distDir).filter((file) => /^sitemap.*\.xml$/i.test(file));
const unexpected = sitemapFiles.filter((file) => file !== allowedSitemap);

if (!sitemapFiles.includes(allowedSitemap) || unexpected.length > 0) {
  throw new Error(
    `Expected only ${allowedSitemap} in dist. Found: ${sitemapFiles.join(', ') || 'none'}`,
  );
}

console.log(`Single sitemap verified: ${allowedSitemap}`);
