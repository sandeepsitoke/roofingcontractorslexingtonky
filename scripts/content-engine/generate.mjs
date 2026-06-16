import fs from 'node:fs/promises';
import path from 'node:path';
import { generateWithProvider, writeFallbackSvg } from './provider.mjs';
import { validateGeneratedPost, writePostMdx } from './render.mjs';
import { parseArgs, readJson, rootDir, todayIso, writeJson } from './utils.mjs';

const SITE = {
  name: 'Roofing Contractors Lexington KY',
  phoneDisplay: '(859) 809-8024',
  phoneHref: 'tel:+18598098024',
  url: 'https://roofingcontractorslexingtonky.com',
};

const args = parseArgs(process.argv.slice(2));
const dryRun = Boolean(args['dry-run'] || process.env.CONTENT_DRY_RUN === 'true');
const brief = await resolveBrief(args);
const promptPolicy = await fs.readFile(path.join(rootDir, 'content-engine/prompts/claude-blog-skill.md'), 'utf8');
const manifest = await readJson('src/content/blog-manifest.json');

if (manifest.some(p => p.slug === brief.id)) {
  throw new Error(`A post with slug/id "${brief.id}" is already in the manifest.`);
}

const duplicateIntent = manifest.find(p =>
  normalize(p.title).includes(normalize(brief.targetKeyword)) ||
  normalize(brief.targetKeyword).includes(normalize(p.title))
);
if (duplicateIntent) {
  throw new Error(`Possible duplicate intent with existing post: ${duplicateIntent.slug}`);
}

const post = await generateWithProvider({ brief, site: SITE, promptPolicy });
validateGeneratedPost(post);

const mdxPath = await writePostMdx(post, { dryRun });
await writeMedia(post, { dryRun });

if (!dryRun) {
  await updateManifest(post);
  await updateState(post, brief);
}

console.log(JSON.stringify({
  ok: true,
  dryRun,
  slug: post.frontmatter.slug,
  mdxPath,
  media: post.media.map(asset => asset.path),
}, null, 2));

async function resolveBrief(parsedArgs) {
  if (parsedArgs.brief) {
    return readJson(`content-engine/briefs/${parsedArgs.brief}.json`);
  }
  if (parsedArgs.queue) {
    const calendar = await readJson('content-engine/calendar.json');
    const state = await readJson('content-engine/state.json');
    const generatedIds = new Set(state.generated.map(item => item.briefId));
    const next = calendar.queue.find(item => !generatedIds.has(item.id));
    if (!next) throw new Error('No queued content briefs remain.');
    return next;
  }
  throw new Error('Pass --brief <id> or --queue.');
}

async function writeMedia(post, { dryRun }) {
  for (const asset of post.media) {
    const relative = asset.path.replace(/^\//, '');
    if (asset.dataUrl) {
      const [, meta, data] = asset.dataUrl.match(/^data:([^;]+);base64,(.+)$/) || [];
      if (!meta || !data) throw new Error(`Invalid data URL for media asset ${asset.filename}`);
      const outputPath = dryRun
        ? `content-engine/drafts/images/${post.frontmatter.slug}/${asset.filename}`
        : `public/${relative}`;
      const target = path.join(rootDir, outputPath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, Buffer.from(data, 'base64'));
      continue;
    }
    if (asset.model === 'fallback-svg') {
      const outputPath = dryRun
        ? `content-engine/drafts/images/${post.frontmatter.slug}/${asset.filename}`
        : `public/${relative}`;
      await writeFallbackSvg(outputPath, asset.alt);
    }
  }
}

async function updateManifest(post) {
  const manifest = await readJson('src/content/blog-manifest.json');
  const nextEntry = {
    slug: post.frontmatter.slug,
    title: post.frontmatter.title,
    excerpt: post.excerpt,
    readTime: `${post.frontmatter.readTime} min read`,
    date: post.frontmatter.date,
    service: post.frontmatter.service,
    location: post.frontmatter.location,
    generated: true,
  };
  const merged = [
    nextEntry,
    ...manifest.filter(item => item.slug !== nextEntry.slug),
  ].sort((a, b) => b.date.localeCompare(a.date));
  await writeJson('src/content/blog-manifest.json', merged);
}

async function updateState(post, brief) {
  const state = await readJson('content-engine/state.json');
  state.lastRun = new Date().toISOString();
  state.generated = [
    ...state.generated.filter(item => item.slug !== post.frontmatter.slug),
    {
      briefId: brief.id,
      slug: post.frontmatter.slug,
      date: todayIso(),
      textModel: process.env.PUTER_TEXT_MODEL || 'fallback-local',
      imageModel: process.env.PUTER_IMAGE_MODEL || post.media[0]?.model || 'fallback-local',
      imagePrompts: post.media.map(asset => asset.prompt),
      qaStatus: 'pending',
      publishStatus: 'generated',
    },
  ];
  await writeJson('content-engine/state.json', state);
}

function normalize(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
