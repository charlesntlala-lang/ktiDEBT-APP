export const Colors = {
  background: '#F0F4F8',
  surface: '#FFFFFF',
  primary: '#1A365D',
  primaryLight: '#2B6CB0',
  accent: '#E07A2F',
  accentLight: '#FBD38D',
  white: '#FFFFFF',
  black: '#1A202C',
  cardBg: '#FFFFFF',
  red: '#E53E3E',
  redLight: '#FED7D7',
  orange: '#DD6B20',
  orangeLight: '#FEEBC8',
  green: '#38A169',
  greenLight: '#C6F6D5',
  textPrimary: '#1A202C',
  textSecondary: '#718096',
  textMuted: '#A0AEC0',
  border: '#E2E8F0',
  overlay: 'rgba(0,0,0,0.5)',
  inputBg: '#F7FAFC',
  shadow: 'rgba(0,0,0,0.08)',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const Typography = {
  h1: { fontSize: 32, fontWeight: '900' as const, letterSpacing: -0.5 },
  h2: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: '700' as const },
  body: { fontSize: 16, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '600' as const },
  small: { fontSize: 11, fontWeight: '700' as const },
};

import { Platform } from 'react-native';

export const Shadows = {
  sm: Platform.select({
    ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
    android: { elevation: 1 },
  }),
  md: Platform.select({
    ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
    android: { elevation: 3 },
  }),
  lg: Platform.select({
    ios: { shadowColor: Colors.black, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16 },
    android: { elevation: 6 },
  }),
};
