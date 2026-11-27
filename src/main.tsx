import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/outfit'
import './styles.css'
import { App } from './App'
import { PoseSheet } from './screens/PoseSheet'

const debug = new URLSearchParams(location.search).has('poses')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{debug ? <PoseSheet /> : <App />}</StrictMode>,
)
