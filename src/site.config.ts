export const SITE = {
  name: 'Roofing Contractors Lexington KY',
  shortName: 'Lexington Roofing',
  url: 'https://roofingcontractorslexingtonky.com',
  email: 'quotes@roofingcontractorslexingtonky.com',
  phoneDisplay: '(859) 809-8024',
  phoneRaw: '+18598098024',
  phoneHref: 'tel:+18598098024',
  address: null,
  geo: { lat: 38.0406, lng: -84.5037 },
  hours: 'Open 24 hours',
  priceRange: '$$',
  state: 'KY',
  primaryCity: 'Lexington',
};

export const SERVICE_AREAS = [
  { slug: 'lexington', name: 'Lexington', zip: '40507', driveFromBase: 'Primary service area' },
  { slug: 'nicholasville', name: 'Nicholasville', zip: '40356', driveFromBase: '25 min from Lexington' },
  { slug: 'georgetown', name: 'Georgetown', zip: '40324', driveFromBase: '30 min from Lexington' },
  { slug: 'richmond', name: 'Richmond', zip: '40475', driveFromBase: '40 min from Lexington' },
  { slug: 'versailles', name: 'Versailles', zip: '40383', driveFromBase: '25 min from Lexington' },
  { slug: 'winchester', name: 'Winchester', zip: '40391', driveFromBase: '30 min from Lexington' },
];

export function areaUrl(slug: string): string {
  return slug === 'lexington' ? '/' : `/service-areas/${slug}-roofing`;
}

export const SERVICES = [
  {
    slug: 'roof-repair',
    title: 'Roof Repair',
    short: 'Fix active leaks, missing shingles, flashing problems, and worn roof details before water spreads.',
    image: '/images/roofing/roof-repair-lexington.webp',
    alt: 'Roofer inspecting shingles on a Lexington home',
  },
  {
    slug: 'emergency-roof-repair',
    title: 'Emergency Roof Repair',
    short: 'Fast help after sudden leaks, wind damage, fallen limbs, or storm-related roof problems.',
    image: '/images/roofing/emergency-roof-repair-lexington.webp',
    alt: 'Roofer checking a damp roof after storm damage in Lexington',
  },
  {
    slug: 'roof-replacement',
    title: 'Roof Replacement',
    short: 'Replace an aging or storm-worn roof with clear options for shingles, ventilation, and budget.',
    image: '/images/roofing/roof-replacement-lexington.webp',
    alt: 'Roofing consultation outside a Lexington home',
  },
  {
    slug: 'storm-damage-roof-repair',
    title: 'Storm Damage Roof Repair',
    short: 'Document wind, hail, shingle, flashing, and gutter damage with conservative repair guidance.',
    image: '/images/roofing/storm-damage-roof-repair-lexington.webp',
    alt: 'Roofing inspector reviewing a Lexington home after a storm',
  },
  {
    slug: 'roof-inspection',
    title: 'Roof Inspection',
    short: 'Check shingles, flashing, vents, valleys, gutters, attic signs, and next-step repair priorities.',
    image: '/images/roofing/roof-inspection-lexington.webp',
    alt: 'Roof inspector reviewing a Lexington home from the driveway',
  },
  {
    slug: 'roof-leak-repair',
    title: 'Roof Leak Repair',
    short: 'Trace roof leaks to shingles, valleys, flashing, pipe boots, chimney details, or gutter issues.',
    image: '/images/roofing/roof-leak-repair-lexington.webp',
    alt: 'Gloved hands checking roof flashing near a gutter',
  },
];

export const NAV = [
  { label: 'Home', href: '/' },
  { label: 'Roof Repair', href: '/roof-repair' },
  { label: 'Emergency Repair', href: '/emergency-roof-repair' },
  { label: 'Replacement', href: '/roof-replacement' },
  { label: 'Service Areas', href: '/service-areas/' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];
