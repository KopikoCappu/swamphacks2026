/**
 * InkBuddy mascot. Default: a colossal squid silhouette (one color, eye cut out). 100×100 viewBox.
 * The chibi variants are kept as alternates.
 * Used by <Logo> (Skia ImageSVG) and by the icon script for the app icon / favicon / splash.
 */
export const BODY = '#7B61FF';
export const BODY_DARK = '#5B3FE6';

export type LogoVariant = 'colossal' | 'calamari' | 'chibi' | 'dots' | 'drop';

const FACE = (y: number, spread = 12) => `
  <ellipse cx="${50 - spread}" cy="${y}" rx="6" ry="7.5" fill="#1C1830"/>
  <ellipse cx="${50 + spread}" cy="${y}" rx="6" ry="7.5" fill="#1C1830"/>
  <circle cx="${52 - spread}" cy="${y - 3}" r="2.6" fill="#FFFFFF"/>
  <circle cx="${52 + spread}" cy="${y - 3}" r="2.6" fill="#FFFFFF"/>
  <circle cx="${48 - spread}" cy="${y + 3}" r="1.1" fill="#FFFFFF"/>
  <circle cx="${48 + spread}" cy="${y + 3}" r="1.1" fill="#FFFFFF"/>
  <ellipse cx="${50 - spread - 9}" cy="${y + 9}" rx="5" ry="2.6" fill="#FF8FB1" opacity="0.75"/>
  <ellipse cx="${50 + spread + 9}" cy="${y + 9}" rx="5" ry="2.6" fill="#FF8FB1" opacity="0.75"/>
  <path d="M46 ${y + 8} Q50 ${y + 12} 54 ${y + 8}" fill="none" stroke="#1C1830" stroke-width="2.2" stroke-linecap="round"/>`;

const SPARK = (x: number, y: number, r: number, color = '#FFC94D') =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${color}"/>`;

const GRAD = `<defs>
  <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#A08CFF"/>
    <stop offset="1" stop-color="#6A48F2"/>
  </linearGradient>
</defs>`;


/**
 * Colossal squid silhouette, one solid color (works on any background): broad tail fins, bulky mantle,
 * eight thick arms and two long clubbed tentacles. The eye is a real hole (even-odd fill), not a painted dot.
 */
function colossal(color: string) {
  // Eight arms fanning out of the head, each with a little curl: [start x, c1x, c1y, c2x, c2y, end x, end y]
  const arms = [
    [43.6, 38, 76, 30, 78, 27, 85],
    [45.2, 41, 80, 36, 84, 34, 90],
    [46.8, 45, 82, 40, 88, 41, 93],
    [48.4, 48, 84, 46, 90, 48, 95],
    [51.6, 52, 84, 54, 90, 52, 95],
    [53.2, 55, 82, 60, 88, 59, 93],
    [54.8, 59, 80, 64, 84, 66, 90],
    [56.4, 62, 76, 70, 78, 73, 85],
  ];
  return `<g transform="translate(52 48) rotate(24) scale(0.8) translate(-50 -52)">
  <path fill="${color}" fill-rule="evenodd" d="
    M50 1 C55 5 65 11 74 17 C80 21 82 27 80 32 C77 29 70 27 63 30
    C66 37 67 44 66.5 51 C66 58 62 63 58.5 65 C59.5 68 59.5 71 58 74 L42 74 C40.5 71 40.5 68 41.5 65
    C38 63 34 58 33.5 51 C33 44 34 37 37 30 C30 27 23 29 20 32 C18 27 20 21 26 17 C35 11 45 5 50 1 Z
    M55.5 67.5 m-3.4 0 a3.4 3 0 1 0 6.8 0 a3.4 3 0 1 0 -6.8 0 Z"/>
  <g fill="none" stroke="${color}" stroke-linecap="round">
    ${arms.map(([x0, ax, ay, bx, by, x1, y1]) => `<path d="M${x0} 72 C${ax} ${ay} ${bx} ${by} ${x1} ${y1}" stroke-width="3"/>`).join('')}
    <path d="M47 73 C44 84 32 84 28 91 C25 96 20 97 17 95" stroke-width="1.6"/>
    <path d="M53 73 C56 84 68 84 72 91 C75 96 80 97 83 95" stroke-width="1.6"/>
  </g>
  <ellipse cx="16" cy="94.4" rx="3.4" ry="2" transform="rotate(30 16 94.4)" fill="${color}"/>
  <ellipse cx="84" cy="94.4" rx="3.4" ry="2" transform="rotate(-30 84 94.4)" fill="${color}"/>
  </g>`;
}

function body(variant: LogoVariant, color: string) {
  if (variant === 'colossal') return colossal(color);
  switch (variant) {
    case 'dots':
      // A round head and tentacles made of shrinking ink dots.
      return `${GRAD}
  <circle cx="50" cy="42" r="30" fill="url(#body)"/>
  <ellipse cx="38" cy="24" rx="9" ry="5" fill="#FFFFFF" opacity="0.28" transform="rotate(-25 38 24)"/>
  ${[29, 43, 57, 71].map((x) => `<circle cx="${x}" cy="77" r="6" fill="#6A48F2"/>`).join('')}
  ${[29, 43, 57, 71].map((x) => `<circle cx="${x}" cy="88" r="3.8" fill="#6A48F2" opacity="0.8"/>`).join('')}
  ${[29, 43, 57, 71].map((x) => `<circle cx="${x}" cy="96" r="2" fill="#6A48F2" opacity="0.6"/>`).join('')}
  ${FACE(44)}`;
    case 'drop':
      // Body shaped like an ink droplet, curly tentacles.
      return `${GRAD}
  <g fill="none" stroke="#6A48F2" stroke-width="8" stroke-linecap="round">
    <path d="M30 70 C26 80 18 80 20 88"/>
    <path d="M43 73 C43 84 36 86 38 93"/>
    <path d="M57 73 C57 84 64 86 62 93"/>
    <path d="M70 70 C74 80 82 80 80 88"/>
  </g>
  <path d="M50 6 C58 18 82 34 82 52 C82 68 68 76 50 76 C32 76 18 68 18 52 C18 34 42 18 50 6 Z" fill="url(#body)"/>
  <ellipse cx="38" cy="34" rx="7" ry="4" fill="#FFFFFF" opacity="0.3" transform="rotate(-35 38 34)"/>
  ${FACE(52)}`;
    case 'calamari':
      // Juvenile southern calamari: short oval mantle wrapped in full-length fins, huge bug eyes,
      // a stubby bundle of arms, freckle-like chromatophores.
      return `${GRAD}
  <defs>
    <linearGradient id="fin" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#C9BCFF"/>
      <stop offset="1" stop-color="#A893FF"/>
    </linearGradient>
  </defs>
  <path d="M47 11 C30 13 15 28 15 44 C15 54 24 60 36 57 Z" fill="url(#fin)"/>
  <path d="M53 11 C70 13 85 28 85 44 C85 54 76 60 64 57 Z" fill="url(#fin)"/>
  <path d="M44 15 C30 19 20 31 20 44" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
  <path d="M56 15 C70 19 80 31 80 44" fill="none" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round" opacity="0.6"/>
  <g fill="none" stroke="#6A48F2" stroke-width="5.5" stroke-linecap="round">
    <path d="M37 74 Q34 84 30 89"/>
    <path d="M43 76 Q42 87 39 93"/>
    <path d="M50 77 Q50 88 50 95"/>
    <path d="M57 76 Q58 87 61 93"/>
    <path d="M63 74 Q66 84 70 89"/>
  </g>
  <path d="M50 9 C63 9 69 24 69 40 C69 52 64 60 50 60 C36 60 31 52 31 40 C31 24 37 9 50 9 Z" fill="url(#body)"/>
  <ellipse cx="50" cy="66" rx="22" ry="13" fill="url(#body)"/>
  <ellipse cx="42" cy="20" rx="5" ry="3" fill="#FFFFFF" opacity="0.35" transform="rotate(-30 42 20)"/>
  <g fill="#4A2FD0" opacity="0.35">
    <circle cx="44" cy="30" r="1.8"/><circle cx="55" cy="25" r="1.4"/><circle cx="58" cy="37" r="2"/>
    <circle cx="47" cy="42" r="1.4"/><circle cx="40" cy="47" r="1.6"/><circle cx="61" cy="49" r="1.3"/><circle cx="52" cy="51" r="1.7"/>
  </g>
  <circle cx="39" cy="63" r="10" fill="#FFFFFF"/>
  <circle cx="61" cy="63" r="10" fill="#FFFFFF"/>
  <circle cx="40" cy="64" r="7.2" fill="#1C1830"/>
  <circle cx="60" cy="64" r="7.2" fill="#1C1830"/>
  <circle cx="42.5" cy="60.5" r="2.8" fill="#FFFFFF"/>
  <circle cx="62.5" cy="60.5" r="2.8" fill="#FFFFFF"/>
  <circle cx="37.5" cy="67.5" r="1.2" fill="#FFFFFF"/>
  <circle cx="57.5" cy="67.5" r="1.2" fill="#FFFFFF"/>
  <ellipse cx="27" cy="72" rx="4.5" ry="2.4" fill="#FF8FB1" opacity="0.8"/>
  <ellipse cx="73" cy="72" rx="4.5" ry="2.4" fill="#FF8FB1" opacity="0.8"/>
  <path d="M47 73.5 Q50 76.5 53 73.5" fill="none" stroke="#1C1830" stroke-width="1.8" stroke-linecap="round"/>
  ${SPARK(86, 12, 8)}
  ${SPARK(94, 25, 3.5)}`;
    case 'chibi':
    default:
      // Squishy mochi-like mantle, stubby curled tentacles, a little spark.
      return `${GRAD}
  <g fill="none" stroke="#6A48F2" stroke-width="9" stroke-linecap="round">
    <path d="M28 66 Q26 80 18 83"/>
    <path d="M42 70 Q42 84 36 89"/>
    <path d="M58 70 Q58 84 64 89"/>
    <path d="M72 66 Q74 80 82 83"/>
  </g>
  <path d="M50 10 C72 10 86 30 86 50 C86 66 76 74 62 74 L38 74 C24 74 14 66 14 50 C14 30 28 10 50 10 Z" fill="url(#body)"/>
  <path d="M50 10 C44 10 39 12 35 15 C42 14 47 16 50 20 C53 16 58 14 65 15 C61 12 56 10 50 10 Z" fill="#FFFFFF" opacity="0.18"/>
  <ellipse cx="32" cy="27" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.3" transform="rotate(-30 32 27)"/>
  ${FACE(48)}
  ${SPARK(84, 14, 9)}
  ${SPARK(93, 28, 4)}`;
  }
}

/** Default mascot color: deep ink. */
export const INK = '#1C1C1E';

export function logoSvg({ background, variant = 'colossal', color = INK }: { background?: string; variant?: LogoVariant; color?: string } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
${background ? `<rect width="100" height="100" fill="${background}"/>` : ''}
${body(variant, color)}
</svg>`;
}
