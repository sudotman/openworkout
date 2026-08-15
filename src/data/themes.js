export const THEMES = Object.freeze([
  {
    id: 'graphite',
    name: 'Graphite Acid',
    description: 'Sharp, neutral, high-energy.',
    swatches: ['#11130f', '#f3f2eb', '#d9ff4f'],
    browserColor: '#11130f',
  },
  {
    id: 'terracotta',
    name: 'Terracotta Paper',
    description: 'Warm, tactile, editorial.',
    swatches: ['#2a1d17', '#f1e8dc', '#d4543c'],
    browserColor: '#2a1d17',
  },
  {
    id: 'cobalt',
    name: 'International Blue',
    description: 'Crisp, technical, composed.',
    swatches: ['#111a32', '#f0f2f7', '#3156d9'],
    browserColor: '#111a32',
  },
  {
    id: 'field',
    name: 'Field Notes',
    description: 'Quiet, grounded, restorative.',
    swatches: ['#13231b', '#eceee6', '#9ac866'],
    browserColor: '#13231b',
  },
  {
    id: 'oxblood',
    name: 'Oxblood Studio',
    description: 'Rich, focused, confident.',
    swatches: ['#241416', '#f2ece8', '#972d40'],
    browserColor: '#241416',
  },
  {
    id: 'midnight',
    name: 'Midnight Ice',
    description: 'Deep contrast for late sessions.',
    swatches: ['#080f15', '#17232c', '#73d8ff'],
    browserColor: '#080f15',
  },
])

export const DEFAULT_THEME_ID = 'graphite'

export function normalizeTheme(themeId) {
  return THEMES.some((theme) => theme.id === themeId) ? themeId : DEFAULT_THEME_ID
}

export function getTheme(themeId) {
  return THEMES.find((theme) => theme.id === normalizeTheme(themeId)) || THEMES[0]
}
