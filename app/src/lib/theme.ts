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
