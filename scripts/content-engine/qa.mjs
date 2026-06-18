import fs from 'node:fs/promises';
import path from 'node:path';
import { readJson, rootDir, uniqueValues, writeJson } from './utils.mjs';

const manifest = await readJson('src/content/blog-manifest.json');
const forbidden = await readJson('content-engine/rules/forbidden-claims.json');
const bannedAiPhrases = [
  "in today's digital landscape",
  "it's important to note",
  'dive into',
  'game-changer',
  'revolutionize',
  'seamlessly',
  'cutting-edge',
  'harness the power',
  'delve',
  'elevate',
  'robust',
  'multifaceted',
];
const routes = await discoverRoutes();
const report = {
  ok: true,
  checkedAt: new Date().toISOString(),
  postsChecked: 0,
  errors: [],
  warnings: [],
};

for (const post of manifest) {
  const blogPath = await resolveBlogPath(post.slug);
  const fullPath = path.join(rootDir, blogPath);
  let source;
  try {
    source = await fs.readFile(fullPath, 'utf8');
  } catch {
    report.errors.push(`${blogPath}: missing blog file`);
    continue;
  }
  report.postsChecked += 1;
  checkFrontmatter(post, source, blogPath);
  checkClaims(source, blogPath);
  checkBannedAiPhrases(source, blogPath);
  checkLinks(source, blogPath);
  if (post.generated) {
    await checkCtas(source, blogPath);
    await checkMedia(source, blogPath);
    checkParagraphLength(source, blogPath);
    checkImageProvenanceLanguage(source, blogPath);
  }
  checkSchema(source, blogPath);
}

checkDuplicateSlugs();
await writeJson('content-engine/qa-report.json', report);

if (!report.ok) {
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(report, null, 2));

function fail(message) {
  report.ok = false;
  report.errors.push(message);
}

function checkFrontmatter(post, source, mdxPath) {
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
  for (const field of ['title', 'description', 'date', 'readTime']) {
    if (!new RegExp(`^${field}:`, 'm').test(frontmatter) && !new RegExp(`${field}:\\s+['"]`, 'm').test(frontmatter)) {
      fail(`${mdxPath}: missing frontmatter ${field}`);
    }
  }
  if (post.title.length < 35 || post.title.length > 80) report.warnings.push(`${mdxPath}: title length is outside preferred range`);
  const excerpt = post.excerpt || post.description || '';
  if (excerpt.length < 80 || excerpt.length > 180) report.warnings.push(`${mdxPath}: excerpt length is outside preferred range`);
}

function checkClaims(source, mdxPath) {
  const lower = source.toLowerCase();
  for (const pattern of forbidden.patterns) {
    if (lower.includes(pattern.toLowerCase())) fail(`${mdxPath}: forbidden claim "${pattern}"`);
  }
}

function checkBannedAiPhrases(source, mdxPath) {
  const lower = source.toLowerCase();
  for (const phrase of bannedAiPhrases) {
    if (lower.includes(phrase)) fail(`${mdxPath}: banned AI phrase "${phrase}"`);
  }
}

function checkLinks(source, mdxPath) {
  const links = uniqueValues([
    ...[...source.matchAll(/href=["']([^"']+)["']/g)].map(match => match[1]),
    ...[...source.matchAll(/\]\((\/[^)]+)\)/g)].map(match => match[1]),
  ]).filter(href => href.startsWith('/') && !href.startsWith('//'));

  for (const href of links) {
    if (href.startsWith('/images/') || href.startsWith('/favicon')) continue;
    const clean = href.replace(/#.*$/, '').replace(/\/$/, '') || '/';
    if (!routes.has(clean)) fail(`${mdxPath}: broken internal link ${href}`);
  }
}

async function checkCtas(source, mdxPath) {
  const phoneLinks = (source.match(/SITE\.phoneHref|tel:\+18598098024/g) || []).length;
  if (phoneLinks < 2) fail(`${mdxPath}: requires at least two phone CTAs`);
  const firstPhone = source.search(/SITE\.phoneHref|tel:\+18598098024/);
  if (firstPhone > 5000) report.warnings.push(`${mdxPath}: first phone CTA appears late in the source`);
}

async function checkMedia(source, mdxPath) {
  const imagePaths = uniqueValues([...source.matchAll(/heroImage:\s+["']([^"']+)["']/g)].map(match => match[1]));
  for (const imagePath of imagePaths) {
    if (!imagePath.startsWith('/images/blog/')) fail(`${mdxPath}: hero image must live under /images/blog/`);
    const diskPath = path.join(rootDir, 'public', imagePath);
    try {
      await fs.access(diskPath);
    } catch {
      fail(`${mdxPath}: missing image ${imagePath}`);
    }
  }
  if (!/heroAlt:/.test(source)) fail(`${mdxPath}: missing heroAlt`);
}

function checkSchema(source, mdxPath) {
  if (!source.includes("'@type': 'BlogPosting'") && !source.includes('"@type": "BlogPosting"')) {
    fail(`${mdxPath}: missing BlogPosting schema`);
  }
}

function checkParagraphLength(source, mdxPath) {
  const paragraphs = [...source.matchAll(/<p>([\s\S]*?)<\/p>/g)].map(match =>
    match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').trim()
  );
  paragraphs.forEach((paragraph, index) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length > 150) fail(`${mdxPath}: paragraph ${index + 1} exceeds 150 words`);
  });
}

function checkImageProvenanceLanguage(source, mdxPath) {
  if (/real customer|real job-site|actual customer|our technician pictured/i.test(source)) {
    fail(`${mdxPath}: generated post implies fake image provenance`);
  }
  if (/AI-generated editorial image|documented service visit photo/i.test(source)) {
    fail(`${mdxPath}: generated post exposes image provenance language on-page`);
  }
}

function checkDuplicateSlugs() {
  const seen = new Set();
  for (const item of manifest) {
    if (seen.has(item.slug)) fail(`duplicate manifest slug ${item.slug}`);
    seen.add(item.slug);
  }
}

async function discoverRoutes() {
  const routes = new Set(['/']);
  const pagesDir = path.join(rootDir, 'src/pages');
  await walk(pagesDir);
  routes.add('/blog');
  routes.add('/contact');
  for (const route of [
    '/roof-repair',
    '/emergency-roof-repair',
    '/roof-replacement',
    '/storm-damage-roof-repair',
    '/roof-inspection',
    '/roof-leak-repair',
    '/roof-leaking-after-storm-lexington-ky',
    '/missing-shingles-lexington-ky',
    '/hail-damaged-roof-lexington-ky',
    '/roof-insurance-claim-help-lexington-ky',
    '/emergency-roof-tarping-lexington-ky',
    '/water-stains-on-ceiling-lexington-ky',
    '/same-day-roof-repair-lexington-ky',
    '/24-hour-roofer-lexington-ky',
    '/free-roof-inspection-lexington-ky',
    '/roof-financing-lexington-ky',
    '/service-areas/nicholasville-roofing',
    '/service-areas/georgetown-roofing',
    '/service-areas/richmond-roofing',
    '/service-areas/versailles-roofing',
    '/service-areas/winchester-roofing',
  ]) routes.add(route);
  return routes;

  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!/\.(astro|mdx)$/.test(entry.name)) continue;
      const rel = path.relative(pagesDir, full).replace(/\\/g, '/');
      let route = `/${rel.replace(/\.(astro|mdx)$/, '')}`;
      route = route.replace(/\/index$/, '') || '/';
      routes.add(route);
    }
  }
}

async function resolveBlogPath(slug) {
  const mdxPath = `src/pages/blog/${slug}.mdx`;
  if (await exists(mdxPath)) return mdxPath;
  return `src/pages/blog/${slug}.astro`;
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
}
