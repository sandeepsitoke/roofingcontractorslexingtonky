# Claude Blog Skill Adaptation for Local Roofing Lead Generation

This prompt contract adapts the local lead-generation writing policy for Roofing Contractors Lexington KY.

## Writing Rules

- Write for homeowners who may need roof repair, emergency roof leak help, storm damage review, inspection, or roof replacement.
- Open with the real homeowner problem and the fastest safe path to calling.
- Use conservative, factual wording around insurance and storm damage.
- Never invent real jobs, real technicians, customer names, reviews, licenses, awards, guarantees, or exact photo provenance.
- Every public image must be AI-generated through the engine and described with normal accessibility alt text only.
- Do not add visible public AI disclosure captions.
- Include at least two phone CTAs using `SITE.phoneHref`.
- Link only to existing routes.

## Required Output Shape

Return structured JSON first:

- frontmatter: title, description, date, readTime, service, location, slug, heroImage, heroAlt
- article sections
- FAQ items
- internal links
- BlogPosting schema
- image prompts and internal safety notes

The renderer converts the JSON into MDX.
