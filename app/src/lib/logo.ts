/**
 * InkBuddy mascot: a squid whose body is a pencil — the sharpened tip is its pointy mantle, little fins on
 * the wood cone, eyes on the barrel, and wavy tentacles trailing ink. 100×100 viewBox.
 * Used by <Logo> (Skia ImageSVG) and by scripts/make-icons.cjs for the app icon / favicon / splash.
 */
export const BODY = '#7B61FF';
export const BODY_DARK = '#5B3FE6';

export function logoSvg({ background }: { background?: string } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
${background ? `<rect width="100" height="100" fill="${background}"/>` : ''}
<g transform="rotate(28 50 50)">
  <!-- tentacles (behind the body) -->
  <g fill="none" stroke="${BODY_DARK}" stroke-width="5" stroke-linecap="round">
    <path d="M39 66 C35 74 41 78 36 87"/>
    <path d="M45 67 C43 76 48 80 45 91"/>
    <path d="M55 67 C57 76 52 80 55 91"/>
    <path d="M61 66 C65 74 59 78 64 87"/>
  </g>
  <!-- fins -->
  <path d="M39 30 C30 31 26 38 27 45 C31 42 35 40 38 39 Z" fill="${BODY_DARK}"/>
  <path d="M61 30 C70 31 74 38 73 45 C69 42 65 40 62 39 Z" fill="${BODY_DARK}"/>
  <!-- wood cone + graphite tip (the mantle point) -->
  <path d="M36 37 L50 7 L64 37 Z" fill="#F7D9A8"/>
  <path d="M36 37 Q39.5 34 43 37 Q46.5 34 50 37 Q53.5 34 57 37 Q60.5 34 64 37 L64 39 L36 39 Z" fill="#F7D9A8"/>
  <path d="M50 7 L45.4 17 L54.6 17 Z" fill="#2B2540"/>
  <!-- barrel (body) with pencil facets -->
  <path d="M36 37 Q39.5 34 43 37 Q46.5 34 50 37 Q53.5 34 57 37 Q60.5 34 64 37 L64 64 Q64 70 58 70 L42 70 Q36 70 36 64 Z" fill="${BODY}"/>
  <path d="M45.3 35.6 Q46.5 34 47.7 35.2 L47.7 70 L45.3 70 Z" fill="#FFFFFF" opacity="0.18"/>
  <path d="M52.3 35.2 Q53.5 34 54.7 35.6 L54.7 70 L52.3 70 Z" fill="#000000" opacity="0.10"/>
  <!-- face -->
  <circle cx="44" cy="54" r="4.6" fill="#FFFFFF"/>
  <circle cx="56" cy="54" r="4.6" fill="#FFFFFF"/>
  <circle cx="44.8" cy="54.8" r="2.4" fill="#1C1830"/>
  <circle cx="56.8" cy="54.8" r="2.4" fill="#1C1830"/>
  <circle cx="45.6" cy="53.8" r="0.9" fill="#FFFFFF"/>
  <circle cx="57.6" cy="53.8" r="0.9" fill="#FFFFFF"/>
  <ellipse cx="40" cy="61" rx="2.6" ry="1.5" fill="#FF8FB1" opacity="0.8"/>
  <ellipse cx="60" cy="61" rx="2.6" ry="1.5" fill="#FF8FB1" opacity="0.8"/>
  <path d="M47.5 61 Q50 63.4 52.5 61" fill="none" stroke="#1C1830" stroke-width="1.4" stroke-linecap="round"/>
</g>
<!-- a drop of ink by the tip -->
<path d="M80 22 C80 22 75.5 28 75.5 30.6 A4.5 4.5 0 0 0 84.5 30.6 C84.5 28 80 22 80 22 Z" fill="${BODY_DARK}"/>
</svg>`;
}
