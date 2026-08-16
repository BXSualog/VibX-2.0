export const colors = {
  primary: '#2563EB',
  accent: '#60A5FA',
  background: '#0B1220',
  surface: '#111827',
  elevated: '#1F2937',
  text: '#F8FAFC',
  muted: '#94A3B8',
  highlight: '#3B82F6',
  success: '#22C55E',
  vyzeNavy: '#081220',
  vyzeSky: '#7DD3FC',
  vyzeIce: '#E0F2FE',
  vyzeMist: '#93C5FD',
} as const;

export type VibxColor = (typeof colors)[keyof typeof colors];
