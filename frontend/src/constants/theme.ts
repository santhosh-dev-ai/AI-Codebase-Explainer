export const theme = {
  colors: {
    background: '#0d1117',
    surface: '#161b22',
    border: '#30363d',
    textPrimary: '#c9d1d9',
    textSecondary: '#8b949e',
    accent: '#58a6ff',
    success: '#3fb950',
    warning: '#d29922',
    error: '#f85149',
    hover: '#1c2128',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
    '2xl': '32px',
    '3xl': '48px',
    '4xl': '64px',
  },
  borderRadius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
  },
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '14px',
    md: '16px',
    lg: '20px',
    xl: '24px',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  transitions: {
    fast: '150ms',
    normal: '250ms',
    slow: '350ms',
  },
} as const;

export type Theme = typeof theme;
