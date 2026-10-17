import { Platform, type ViewStyle } from 'react-native';

/** Quiet, neutral palette — the ink is the only color on screen. */
export const C = {
  bg: '#F4F4F2',
  paper: '#FFFFFF',
  surface: '#FFFFFF',
  border: 'rgba(0,0,0,0.08)',
  text: '#1C1C1E',
  icon: '#3A3A3C',
  muted: '#8E8E93',
  faint: '#C7C7CC',
  selected: 'rgba(0,0,0,0.07)',
  primary: '#1C1C1E', // the one strong element (Ask AI, send)
  onPrimary: '#FFFFFF',
  focus: '#2F6FEB', // selection outline
  danger: '#E5484D',
};

export const R = { sm: 8, md: 12, lg: 16, pill: 999 };

export const shadow: ViewStyle = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)' } as ViewStyle,
  default: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
})!;

/** Folder color tags (sidebar icons, card stripes, banner tint). */
export const FOLDER_COLORS = ['#7B61FF', '#2F80ED', '#14A38B', '#F2994A', '#EB5757', '#E84393', '#F2C94C', '#56657F'];

/** A folder's color; older folders without one get a stable color from their id. */
export function folderColor(f: { id: string; color?: string } | undefined | null) {
  if (!f) return C.muted;
  if (f.color) return f.color;
  let h = 0;
  for (const ch of f.id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return FOLDER_COLORS[Math.abs(h) % FOLDER_COLORS.length];
}

/** Mix a hex color toward white (t=0 → color, t=1 → white). */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0');
  return `#${ch((n >> 16) & 255)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
