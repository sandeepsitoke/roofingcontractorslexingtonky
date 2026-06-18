// Deploy this file as a Puter Worker if you want live Puter AI generation.
// The local Astro site never imports this file; it is an integration template.

router.post('/generate', async request => {
  const payload = await request.json();
  const { brief, site, promptPolicy, textModel, imageModel } = payload;

  const messages = [
    {
      role: 'system',
      content: `${promptPolicy}

Return only strict JSON with this shape:
{
  "frontmatter": {
    "slug": "kebab-case",
    "title": "...",
    "description": "...",
    "date": "YYYY-MM-DD",
    "readTime": 6,
    "service": "...",
    "location": "...",
    "targetKeyword": "...",
    "heroImage": "/images/blog/<slug>/hero.webp",
    "heroAlt": "Clean local-service alt text with service, object, and location context only",
  },
  "excerpt": "...",
  "eyebrow": "...",
  "intro": "...",
  "sections": [{ "heading": "...", "body": ["...", "..."] }],
  "faqs": [{ "q": "...", "a": "..." }],
  "internalLinks": ["/ac-repair", "/contact"],
  "media": [{ "filename": "hero.webp", "path": "/images/blog/<slug>/hero.webp", "prompt": "...", "model": "...", "alt": "...", "placement": "hero", "generatedDate": "YYYY-MM-DD" }],
  "safetyNotes": ["..."]
}`,
    },
    {
      role: 'user',
      content: JSON.stringify({ brief, site }),
    },
  ];

  const draft = await puter.ai.chat(messages, {
    model: textModel || 'claude-opus-4-5',
    temperature: 0.3,
  });

  const text = typeof draft === 'string' ? draft : draft.message?.content?.[0]?.text || draft.message?.content || String(draft);
  const json = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ''));
  const hero = json.media?.[0];

  if (hero?.prompt) {
    const image = await puter.ai.txt2img(hero.prompt, {
      model: imageModel || 'gpt-image-2',
      quality: 'medium',
      ratio: { w: 16, h: 9 },
    });
    hero.dataUrl = image.src;
    hero.model = imageModel || 'gpt-image-2';
  }

  return Response.json(json);
});
