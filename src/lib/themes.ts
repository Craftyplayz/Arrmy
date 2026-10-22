/** Colour themes: the palettes are in app/themes.css under [data-theme="<id>"]; `color` is the phone browser bar. */
export const THEMES = [
  { id: 'default', label: 'Dark blue', color: '#171b20', light: false },
  { id: 'light', label: 'Light', color: '#efe9df', light: true },
  { id: 'paper', label: 'Paper', color: '#ebe3d2', light: true },
  { id: 'terminal', label: 'Terminal', color: '#060806', light: false },
  { id: 'violet', label: 'Violet', color: '#121019', light: false },
] as const

export type ThemeId = (typeof THEMES)[number]['id']

export const themeOf = (id: unknown) => THEMES.find((t) => t.id === id)
