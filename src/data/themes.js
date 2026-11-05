export const THEMES = Object.freeze([
  {
    id: 'carbon',
    name: 'Carbon',
    description: 'Graphite and signal orange.',
    swatches: ['#090a0a', '#1d2020', '#ff5a1f'],
    browserColor: '#090a0a',
  },
  {
    id: 'void',
    name: 'Void',
    description: 'True black, built for OLED.',
    swatches: ['#000000', '#171b1e', '#38d6ff'],
    browserColor: '#000000',
  },
  {
    id: 'oxide',
    name: 'Oxide',
    description: 'Warm iron and amber.',
    swatches: ['#100d0a', '#25201a', '#ffa72e'],
    browserColor: '#100d0a',
  },
  {
    id: 'indigo',
    name: 'Indigo',
    description: 'Cool, quiet, late sessions.',
    swatches: ['#0a0b13', '#1c1f2b', '#8098ff'],
    browserColor: '#0a0b13',
  },
  {
    id: 'bone',
    name: 'Bone',
    description: 'Daylight, paper and ink.',
    swatches: ['#efece6', '#e4e0d8', '#e8491a'],
    browserColor: '#efece6',
  },
])

export const DEFAULT_THEME_ID = 'carbon'

// Themes retired in the November 2026 redesign, mapped to their closest
// successor so a saved choice carries its character over instead of resetting.
const LEGACY_THEMES = Object.freeze({
  graphite: 'carbon',
  terracotta: 'oxide',
  cobalt: 'indigo',
  field: 'carbon',
  oxblood: 'oxide',
  midnight: 'void',
})

export function normalizeTheme(themeId) {
  if (THEMES.some((theme) => theme.id === themeId)) return themeId
  return LEGACY_THEMES[themeId] || DEFAULT_THEME_ID
}

export function getTheme(themeId) {
  return THEMES.find((theme) => theme.id === normalizeTheme(themeId)) || THEMES[0]
}

/** Themes that paint light-on-dark, which the browser chrome needs to know. */
export function isDarkTheme(themeId) {
  return normalizeTheme(themeId) !== 'bone'
}
