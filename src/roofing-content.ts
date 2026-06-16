import { SERVICES } from './site.config';

const descriptions: Record<string, string> = {
  'roof-repair': 'Call for shingle repairs, flashing fixes, roof leak tracing, storm-related damage checks, and practical repair options before water reaches ceilings, insulation, or decking.',
  'emergency-roof-repair': 'When a roof leak appears after wind or heavy rain, call for fast triage, temporary protection guidance, and a repair visit focused on stopping active water entry.',
  'roof-replacement': 'Get a straightforward roof replacement conversation: condition check, shingle options, ventilation review, decking concerns, timeline, and a clear estimate.',
  'storm-damage-roof-repair': 'After Kentucky storms, have wind, hail, flashing, ridge, valley, and gutter-related roof concerns reviewed without exaggerated damage claims.',
  'roof-inspection': 'A roof inspection helps you understand visible shingle wear, flashing risks, soft spots, vent details, gutter drainage, and whether repair or replacement is the next move.',
  'roof-leak-repair': 'Roof leaks often start at pipe boots, valleys, chimney flashing, wall transitions, or lifted shingles. The repair starts with finding the water path, not guessing.',
};

const bullets: Record<string, string[]> = {
  'roof-repair': ['Missing or lifted shingles', 'Pipe boot and roof vent leaks', 'Chimney and wall flashing repairs', 'Valley and ridge cap problems', 'Small storm-related repairs'],
  'emergency-roof-repair': ['Active leak triage', 'Wind-lifted shingle response', 'Temporary protection guidance', 'Storm damage review', 'Priority scheduling when water is entering'],
  'roof-replacement': ['Shingle replacement options', 'Decking and ventilation review', 'Tear-off planning', 'Cleanup expectations', 'Clear quote before work begins'],
  'storm-damage-roof-repair': ['Wind and hail indicators', 'Flashing and ridge checks', 'Gutter and drainage review', 'Conservative documentation', 'Repair-first recommendations when appropriate'],
  'roof-inspection': ['Roof age and wear review', 'Shingle, vent, and flashing checks', 'Attic and moisture clues', 'Repair priority list', 'Replacement timing guidance'],
  'roof-leak-repair': ['Leak source tracing', 'Pipe boot replacement', 'Valley and flashing fixes', 'Gutter-related water issues', 'Interior water-entry clues'],
};

const faqs: Record<string, { q: string; a: string }[]> = {
  'roof-repair': [
    { q: 'When should I call for roof repair?', a: 'Call when shingles are missing, water stains appear, flashing looks loose, granules collect in gutters, or a recent storm left roof debris. Small repairs are easier to handle before water reaches decking or insulation.' },
    { q: 'Can a roof be repaired instead of replaced?', a: 'Often yes. If the roof has localized damage and the surrounding shingles are still serviceable, repair can make sense. Replacement becomes more likely when wear is widespread or leaks keep returning.' },
  ],
  'emergency-roof-repair': [
    { q: 'What counts as a roofing emergency?', a: 'Active water entry, missing shingles after wind, damaged flashing during rain, or roof damage that exposes decking should be treated as urgent. Call first so the next step is safe and practical.' },
    { q: 'Should I climb on the roof during a leak?', a: 'No. Stay inside, move valuables, contain dripping water if safe, and call for roofing help. Wet shingles, ladders, and storm conditions are dangerous.' },
  ],
  'roof-replacement': [
    { q: 'How do I know if I need roof replacement?', a: 'Replacement may be the better option when shingles are brittle, curling, losing granules across large areas, leaking in multiple places, or nearing the end of their service life.' },
    { q: 'What affects roof replacement cost?', a: 'Roof size, slope, layers, decking condition, shingle choice, ventilation, flashing detail, and access all affect cost. A clear estimate should separate options and explain what is included.' },
  ],
  'storm-damage-roof-repair': [
    { q: 'Should I get a roof checked after a storm?', a: 'Yes if you see missing shingles, debris impact, gutter damage, ceiling stains, or neighbors reporting roof damage. A ground-level check can catch issues before the next rain.' },
    { q: 'Do you promise insurance approval?', a: 'No. Insurance decisions belong to the carrier. The roofing visit can document visible conditions and explain repair options without making guaranteed claim promises.' },
  ],
  'roof-inspection': [
    { q: 'What is checked during a roof inspection?', a: 'A practical inspection reviews shingles, flashing, vents, valleys, ridge caps, gutters, visible drainage patterns, and interior clues when relevant.' },
    { q: 'Can an inspection help before buying or selling?', a: 'Yes. A roof condition check can help clarify repair priorities before a transaction, but it should not replace any inspection required by a lender, buyer, or insurer.' },
  ],
  'roof-leak-repair': [
    { q: 'Why is my roof leaking if shingles look fine?', a: 'Leaks often come from flashing, pipe boots, valleys, wall transitions, nail pops, or gutter overflow. The visible drip inside is rarely directly below the roof entry point.' },
    { q: 'How fast should I call after seeing a stain?', a: 'Call as soon as you see staining, dripping, bubbling paint, or damp insulation. Waiting can turn a small roof detail problem into drywall, insulation, or decking damage.' },
  ],
};

export const areaDetails = [
  { slug: 'lexington', title: 'Roofing Contractors in Lexington, KY', intro: 'Lexington homes deal with humid summers, spring storms, wind-driven rain, and aging shingle roofs. Call for roof repair, inspections, storm damage review, leak tracing, or replacement guidance.', neighborhoods: ['Chevy Chase', 'Hamburg', 'Beaumont', 'Masterson Station', 'Tates Creek'] },
  { slug: 'nicholasville', title: 'Roofing Contractors in Nicholasville, KY', intro: 'Nicholasville homeowners call for leak repairs, storm checks, shingle replacement options, and roof inspections across Jessamine County neighborhoods.', neighborhoods: ['Brannon Crossing', 'Downtown Nicholasville', 'Keene', 'Wilmore Road', 'Southbrook'] },
  { slug: 'georgetown', title: 'Roofing Contractors in Georgetown, KY', intro: 'Georgetown roofs can take wind, hail, and drainage wear. Get practical help for storm damage, roof leaks, inspections, and replacement planning.', neighborhoods: ['Cherry Blossom', 'Downtown Georgetown', 'Paynes Depot', 'Elkhorn Green', 'Oxford'] },
  { slug: 'richmond', title: 'Roofing Contractors in Richmond, KY', intro: 'Richmond homeowners can call for roof leak repair, missing shingles, storm damage checks, and replacement estimates throughout Madison County.', neighborhoods: ['Downtown Richmond', 'Boonesborough', 'Berea Road', 'Lake Reba', 'Eastern Bypass'] },
  { slug: 'versailles', title: 'Roofing Contractors in Versailles, KY', intro: 'Versailles homes need careful shingle, flashing, and gutter checks after wind or heavy rain. Call for roof repairs, inspections, and replacement options.', neighborhoods: ['Downtown Versailles', 'Amsden', 'Mortonsville', 'Midway Road', 'Pisgah Pike'] },
  { slug: 'winchester', title: 'Roofing Contractors in Winchester, KY', intro: 'Winchester homeowners can request help with roof leaks, shingle wear, storm damage review, and roof replacement planning in Clark County.', neighborhoods: ['Downtown Winchester', 'Colby Hills', 'Boonesboro Road', 'Strode Station', 'Indian Old Fields'] },
];

export const serviceDetails = SERVICES.map(service => ({
  ...service,
  eyebrow: service.slug === 'emergency-roof-repair' ? 'Lexington emergency roofing help' : 'Lexington roofing service',
  title: `${service.title} in Lexington, KY`,
  description: descriptions[service.slug],
  bullets: bullets[service.slug],
  faqs: faqs[service.slug],
}));
