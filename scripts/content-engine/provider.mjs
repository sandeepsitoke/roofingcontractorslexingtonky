import fs from 'node:fs/promises';
import path from 'node:path';
import { rootDir, slugify, todayIso } from './utils.mjs';

const DEFAULT_IMAGE_PROMPT =
  'Photorealistic lifestyle roofing image for a local lead-generation blog: Kentucky suburban home with roofline visible, generic homeowner or roofer if useful, natural daylight, no logos, no branded trucks, no readable text, no watermark, not a claimed real job photo.';

export async function generateWithProvider({ brief, site, promptPolicy }) {
  if (process.env.PUTER_CONTENT_WORKER_URL) {
    return generateWithPuterWorker({ brief, site, promptPolicy });
  }
  return generateFallbackPost({ brief, site });
}

async function generateWithPuterWorker({ brief, site, promptPolicy }) {
  const response = await fetch(process.env.PUTER_CONTENT_WORKER_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.PUTER_AUTH_TOKEN ? { authorization: `Bearer ${process.env.PUTER_AUTH_TOKEN}` } : {}),
    },
    body: JSON.stringify({
      brief,
      site,
      promptPolicy,
      textModel: process.env.PUTER_TEXT_MODEL || 'claude-opus-4-5',
      imageModel: process.env.PUTER_IMAGE_MODEL || 'gpt-image-2',
    }),
  });

  if (!response.ok) {
    throw new Error(`Puter content worker failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

function generateFallbackPost({ brief, site }) {
  const slug = slugify(`${brief.targetKeyword || brief.topic}`);
  const title = titleFor(brief);
  const intro = `If a ${brief.service.toLowerCase()} issue shows up in ${brief.location}, the safest path is to call ${site.phoneDisplay} and describe exactly what changed: where water appeared, what the roof looks like from the ground, and whether wind or rain happened recently. This guide gives you the quick checks worth doing before you call and the signs that mean you should stop troubleshooting.`;

  return {
    frontmatter: {
      slug,
      title,
      description: `${brief.service} advice for ${brief.location} homeowners. Learn what to check safely, when to call, and how to get help fast from ${site.name}.`,
      date: todayIso(),
      readTime: 6,
      service: brief.service,
      location: brief.location,
      targetKeyword: brief.targetKeyword,
      heroImage: `/images/blog/${slug}/hero.svg`,
      heroAlt: `Roofing inspection scene at a ${brief.location} home`,
    },
    excerpt: `${brief.service} advice for ${brief.location} homeowners: what to check safely, when to call, and how to avoid letting roof problems spread.`,
    eyebrow: `${brief.service} · ${brief.location}, KY`,
    intro,
    sections: [
      {
        heading: 'First, decide whether this is urgent',
        body: [
          'Call right away if water is entering the home, shingles are missing after wind, flashing looks loose, or ceiling stains are spreading. Those symptoms can move from a small roof detail to interior damage quickly.',
          'If the home is dry and conditions are safe, take photos from the ground and write down where the issue appears indoors. These details help the roofing conversation move faster.',
        ],
      },
      {
        heading: 'What to tell the dispatcher',
        body: [
          'Give your zip code, roof age if known, recent storm timing, and the clearest symptom: leak, missing shingles, lifted flashing, branch impact, or granules in gutters.',
          'Ask about the arrival window, what photos are useful, and whether the issue sounds urgent or can wait for the next available inspection.',
        ],
      },
      {
        heading: 'When repair is better than waiting',
        body: [
          `In ${brief.location}, heavy rain can push a small roof leak into decking, insulation, and drywall. If stains are spreading or shingles are missing, calling early is usually the lower-risk move.`,
          `For a direct appointment, call <a href="${site.phoneHref}">${site.phoneDisplay}</a> and mention that you are in ${brief.location}.`,
        ],
      },
    ],
    faqs: [
      {
        q: `Should I call now for ${brief.service.toLowerCase()} in ${brief.location}?`,
        a: 'Call now if water is actively entering, shingles are missing, flashing is loose, or storm damage is visible from the ground. If the issue is mild, schedule the next available roof inspection.',
      },
      {
        q: 'What should I check before calling?',
        a: 'Check safely from the ground. Look for missing shingles, debris, gutter damage, and where stains appear indoors. Do not climb on a wet or storm-damaged roof.',
      },
      {
        q: 'How do I get the fastest appointment?',
        a: `Have your zip code, roof age, and symptom ready, then call ${site.phoneDisplay}. Clear details help route the request and avoid delays.`,
      },
    ],
    internalLinks: brief.requiredInternalLinks,
    media: [
      {
        filename: 'hero.svg',
        path: `/images/blog/${slug}/hero.svg`,
        prompt: DEFAULT_IMAGE_PROMPT,
        model: 'fallback-svg',
        alt: `Roofing inspection scene at a ${brief.location} home`,
        placement: 'hero',
        generatedDate: todayIso(),
      },
    ],
    safetyNotes: [
      'Fallback copy avoids customer stories, staff names, real-job claims, and review claims.',
      'Fallback image is an editorial placeholder until an AI lifestyle image asset is supplied.',
    ],
  };
}

function titleFor(brief) {
  if (/storm|leak/i.test(brief.topic)) {
    return `Roof Leak After a Storm in ${brief.location}? What to Do Before You Call`;
  }
  if (/maintenance/i.test(brief.topic)) {
    return `${brief.location} Roof Maintenance Before Storm Season: What Matters Most`;
  }
  return `${brief.topic}: A Practical ${brief.location} Homeowner Guide`;
}

export async function writeFallbackSvg(relativePath, alt) {
  const target = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${escapeXml(alt)}">
  <rect width="1200" height="675" fill="#e7eee5"/>
  <rect x="0" y="455" width="1200" height="220" fill="#6f8a65"/>
  <polygon points="180,360 520,190 860,360" fill="#5c3f2d"/>
  <rect x="265" y="350" width="510" height="145" rx="10" fill="#fff8ec"/>
  <rect x="360" y="410" width="110" height="85" fill="#9fb3bf"/>
  <rect x="535" y="408" width="165" height="75" fill="#bdd7e5"/>
  <rect x="790" y="402" width="210" height="120" rx="10" fill="#5b6870"/>
  <path d="M820 392 C890 340 970 350 1030 380" fill="none" stroke="#b54324" stroke-width="14" stroke-linecap="round"/>
  <circle cx="1040" cy="382" r="14" fill="#b54324"/>
</svg>`;
  await fs.writeFile(target, svg);
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
