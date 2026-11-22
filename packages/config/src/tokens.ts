/**
 * Casvitta design tokens ("Planta"). Source of truth for code; mirrors design/tokens.json
 * (a test keeps them in sync). Components never use raw hex values: they use the Tailwind
 * classes generated from these tokens (see tailwind-preset.css).
 */

export const color = {
  'ink-900': '#0F1E3D',
  'ink-700': '#23345A',
  'ink-500': '#4A5568',
  'ink-300': '#9AA5B8',
  'ink-200': '#D6DCE5',
  'ink-100': '#EEF1F5',
  paper: '#F5F7FA',
  surface: '#FFFFFF',
  'blue-700': '#1739A6',
  'blue-600': '#1D4ED8',
  'blue-200': '#BFD0F7',
  'blue-50': '#EAF0FD',
  'yellow-ink': '#6B4A00',
  'yellow-400': '#F2B23A',
  'yellow-200': '#EBCB85',
  'yellow-50': '#FDF3DC',
  'green-600': '#157F4C',
  'green-50': '#E4F3EA',
  'red-600': '#B42318',
  'red-50': '#FCE9E7',
  'chat-bg': '#E9EEF5',
  'disabled-bg': '#E7EAF0',
  'disabled-text': '#6B7486',
} as const;

export type ColorToken = keyof typeof color;

/**
 * Semantic aliases. Components should prefer these so a dark theme can remap them later.
 * Keys become Tailwind colors (e.g. `text-fg`, `bg-action`, `border-line`).
 */
export const semantic = {
  fg: 'ink-900',
  'fg-strong': 'ink-700',
  'fg-muted': 'ink-500',
  'fg-on-action': 'surface',
  line: 'ink-200',
  'line-dashed': 'ink-300',
  canvas: 'paper',
  panel: 'surface',
  subtle: 'ink-100',
  action: 'blue-600',
  'action-hover': 'blue-700',
  'action-subtle': 'blue-50',
  'action-line': 'blue-200',
  focus: 'blue-600',
  attention: 'yellow-400',
  'attention-subtle': 'yellow-50',
  'attention-line': 'yellow-200',
  'attention-fg': 'yellow-ink',
  success: 'green-600',
  'success-subtle': 'green-50',
  danger: 'red-600',
  'danger-subtle': 'red-50',
  // Second brand color of a broker page theme (owner call to action); Planta uses the action blue.
  accent: 'blue-600',
  'accent-subtle': 'blue-50',
} as const satisfies Record<string, ColorToken>;

/**
 * Casvitta Social page themes (docs/mockups/social): presets that remap semantic colors inside
 * an element with data-page-theme="…". Only the public broker page uses them; the product UI stays
 * on Planta. Every pair keeps 4.5:1 text contrast (white on action, accent on accent-subtle).
 */
export const pageThemes = {
  cambui: {
    action: '#1F4D3A',
    'action-hover': '#173B2C',
    'action-subtle': '#E8F1EC',
    'action-line': '#B9D3C5',
    focus: '#1F4D3A',
    canvas: '#FBF8F3',
    subtle: '#F1EBE1',
    line: '#DCD2C2',
    accent: '#A34A2E',
    'accent-subtle': '#F8E9E2',
  },
  planta: {},
  terracota: {
    action: '#A34A2E',
    'action-hover': '#863B24',
    'action-subtle': '#F8E9E2',
    'action-line': '#E7C3B5',
    focus: '#A34A2E',
    canvas: '#FCF7F4',
    subtle: '#F4E9E2',
    line: '#E3D3C8',
    accent: '#1F4D3A',
    'accent-subtle': '#E8F1EC',
  },
} as const satisfies Record<string, Partial<Record<keyof typeof semantic, string>>>;

export type PageThemeName = keyof typeof pageThemes;

export const font = {
  display: "'Familjen Grotesk', Arial, sans-serif",
  body: "'IBM Plex Sans', Arial, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
} as const;

/** CSS variables set by next/font in apps/web; the stacks above are the fallbacks. */
export const fontVariable = {
  display: '--font-familjen-grotesk',
  body: '--font-ibm-plex-sans',
  mono: '--font-ibm-plex-mono',
} as const;

export const space = [4, 8, 12, 16, 24, 32, 48, 64] as const;

export const radius = { chip: 4, control: 6, card: 10, pill: 999 } as const;

/** Almost no shadows: one elevation level for menus and dialogs (DESIGN_SYSTEM.md §3). */
export const shadow = { menu: '0 8px 24px rgb(15 30 61 / 0.12)' } as const;

export const layout = {
  desktopRef: 1440,
  columns: 12,
  gutter: 24,
  margin: 32,
  sideNav: 264,
  mobileRef: 390,
  mobileColumns: 4,
  mobileGutter: 16,
} as const;

type TypeStyle = {
  family: keyof typeof font;
  size: number;
  lineHeight: number;
  weight: number;
  tracking?: string;
  uppercase?: boolean;
};

/** DESIGN_SYSTEM.md §2. Sizes in px. */
export const typography = {
  'display-xl': { family: 'display', size: 48, lineHeight: 52, weight: 600, tracking: '-0.025em' },
  'display-l': { family: 'display', size: 32, lineHeight: 38, weight: 600, tracking: '-0.02em' },
  title: { family: 'display', size: 22, lineHeight: 28, weight: 600 },
  body: { family: 'body', size: 16, lineHeight: 24, weight: 400 },
  'body-s': { family: 'body', size: 14, lineHeight: 20, weight: 400 },
  caption: { family: 'body', size: 12, lineHeight: 16, weight: 400 },
  value: { family: 'mono', size: 24, lineHeight: 28, weight: 600 },
  code: { family: 'mono', size: 13, lineHeight: 16, weight: 400 },
  eyebrow: {
    family: 'mono',
    size: 12,
    lineHeight: 16,
    weight: 400,
    tracking: '0.08em',
    uppercase: true,
  },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1440 } as const;
