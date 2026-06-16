import fs from 'node:fs/promises';
import path from 'node:path';
import { rootDir } from './utils.mjs';

export function validateGeneratedPost(post) {
  const errors = [];
  const fm = post?.frontmatter || {};
  for (const key of ['slug', 'title', 'description', 'date', 'readTime', 'service', 'location', 'heroImage', 'heroAlt']) {
    if (!fm[key]) errors.push(`Missing frontmatter.${key}`);
  }
  if (!Array.isArray(post.sections) || post.sections.length < 3) errors.push('Post needs at least 3 sections');
  if (!Array.isArray(post.faqs) || post.faqs.length < 3) errors.push('Post needs at least 3 FAQs');
  if (!Array.isArray(post.internalLinks) || post.internalLinks.length < 2) errors.push('Post needs at least 2 internal links');
  if (!Array.isArray(post.media) || post.media.length < 1) errors.push('Post needs at least 1 media asset');
  if (errors.length) throw new Error(errors.join('; '));
}

export async function writePostMdx(post, { dryRun = false } = {}) {
  const slug = post.frontmatter.slug;
  const relativePath = dryRun
    ? `content-engine/drafts/${slug}.mdx`
    : `src/pages/blog/${slug}.mdx`;
  const target = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderMdx(post));
  return relativePath;
}

export function renderMdx(post) {
  const fm = post.frontmatter;
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return `---
title: ${JSON.stringify(fm.title)}
description: ${JSON.stringify(fm.description)}
date: ${fm.date}
readTime: ${Number(fm.readTime)}
service: ${JSON.stringify(fm.service)}
location: ${JSON.stringify(fm.location)}
targetKeyword: ${JSON.stringify(fm.targetKeyword || '')}
heroImage: ${JSON.stringify(fm.heroImage)}
heroAlt: ${JSON.stringify(fm.heroAlt)}
generated: true
---

import BaseLayout from '../../layouts/BaseLayout.astro';
import { SITE } from '../../site.config';

export const generatedFaqSchema = ${JSON.stringify(faqSchema, null, 2)};

<BaseLayout
  title={frontmatter.title}
  description={frontmatter.description}
  pageType="article"
  ogImage={frontmatter.heroImage}
  schema={[
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: frontmatter.title,
      description: frontmatter.description,
      datePublished: frontmatter.date,
      image: SITE.url + frontmatter.heroImage,
      author: { '@type': 'Organization', name: SITE.name },
      publisher: { '@type': 'Organization', name: SITE.name },
      mainEntityOfPage: SITE.url + '/blog/${fm.slug}',
    },
    generatedFaqSchema,
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: SITE.url + '/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE.url + '/blog' },
        { '@type': 'ListItem', position: 3, name: frontmatter.title, item: SITE.url + '/blog/${fm.slug}' },
      ],
    },
  ]}
>
  <article class="article">
    <div class="container narrow">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="/">Home</a> <span aria-hidden="true">›</span> <a href="/blog">Blog</a> <span aria-hidden="true">›</span> {frontmatter.title}
      </nav>
      <header class="article-head">
        <span class="eyebrow">${escapeHtml(post.eyebrow || `${fm.service} · ${fm.location}, KY`)}</span>
        <h1>{frontmatter.title}</h1>
        <p class="meta">Published {new Date(frontmatter.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} · {frontmatter.readTime} min read</p>
      </header>

      <figure class="article-hero-image">
        <img src={frontmatter.heroImage} alt={frontmatter.heroAlt} loading="eager" decoding="async" />
      </figure>

      <p>${post.intro}</p>
      <p><strong>Need help now?</strong> Call <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a> for ${escapeHtml(fm.service)} in ${escapeHtml(fm.location)}, or continue reading for the quick checks worth doing first.</p>

${post.sections.map(section => renderSection(section)).join('\n\n')}

      <div class="callout-cta">
        <h2>Need help with ${escapeHtml(fm.service)} in ${escapeHtml(fm.location)}?</h2>
        <p>Call <a href={SITE.phoneHref}>{SITE.phoneDisplay}</a> now, or use the contact page to request the next available appointment.</p>
        <p><a class="btn btn-primary" href={SITE.phoneHref}>Call {SITE.phoneDisplay}</a> <a class="btn btn-secondary" href="/contact">Request Service</a></p>
      </div>

      <h2>Frequently Asked Questions</h2>
${post.faqs.map(faq => `      <h3>${escapeHtml(faq.q)}</h3>\n      <p>${escapeHtml(faq.a)}</p>`).join('\n\n')}
    </div>
  </article>
</BaseLayout>
`;
}

function renderSection(section) {
  return `      <h2>${escapeHtml(section.heading)}</h2>
${section.body.map(paragraph => `      <p>${paragraph}</p>`).join('\n')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}
