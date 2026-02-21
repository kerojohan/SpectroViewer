import type { ThemeColors, ThemeName } from './types';

export const DARK_THEME: ThemeColors = {
  background: '#1a1a2e',
  text: '#e2e8f0',
  textMuted: '#94a3b8',
  timelineBackground: '#1a1a2e',
  timelineText: '#6366f1',
  timelineLine: '#818cf8',
  freqAxisBackground: 'transparent',
  freqAxisText: '#ffffff',
  freqAxisHighlight: '#a5b4fc',
  cursorColor: '#ef4444',
  hoverLineColor: '#7dd3fc',
  hoverLabelBg: '#0ea5e9',
  hoverLabelText: '#ffffff',
  regionColor: 'rgba(239, 68, 68, 0.15)',
  regionSelectedColor: 'rgba(59, 130, 246, 0.2)',
  regionHandleColor: 'rgba(255, 255, 255, 0.4)',
  scrollbarThumb: '#6366f1',
  scrollbarTrack: '#2d2d4a',
};

export const LIGHT_THEME: ThemeColors = {
  background: '#f8fafc',
  text: '#1e293b',
  textMuted: '#64748b',
  timelineBackground: '#f1f5f9',
  timelineText: '#4f46e5',
  timelineLine: '#6366f1',
  freqAxisBackground: 'transparent',
  freqAxisText: '#1e293b',
  freqAxisHighlight: '#4f46e5',
  cursorColor: '#dc2626',
  hoverLineColor: '#0284c7',
  hoverLabelBg: '#0369a1',
  hoverLabelText: '#ffffff',
  regionColor: 'rgba(239, 68, 68, 0.18)',
  regionSelectedColor: 'rgba(59, 130, 246, 0.25)',
  regionHandleColor: 'rgba(0, 0, 0, 0.3)',
  scrollbarThumb: '#6366f1',
  scrollbarTrack: '#e2e8f0',
};

export function resolveTheme(theme: ThemeName | ThemeColors | undefined): ThemeColors {
  if (!theme || theme === 'dark') return DARK_THEME;
  if (theme === 'light') return LIGHT_THEME;
  return { ...DARK_THEME, ...theme };
}
