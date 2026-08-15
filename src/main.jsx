import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource/dm-mono/400.css'
import '@fontsource/dm-mono/500.css'
import { DEFAULT_THEME_ID, normalizeTheme } from './data/themes.js'
import App from './App.jsx'
import './styles.css'
import './register-sw.js'

try {
  const savedState = JSON.parse(localStorage.getItem('openworkout:app-state') || '{}')
  document.documentElement.dataset.theme = normalizeTheme(savedState?.settings?.theme)
} catch {
  document.documentElement.dataset.theme = DEFAULT_THEME_ID
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
