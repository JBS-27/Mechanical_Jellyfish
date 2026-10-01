import { useCallback, useEffect, useRef, useState } from 'react'
import Interface from './Interface'
import MedusaScene from './MedusaScene'
import { THEMES } from './data'
import './App.css'

const THEME_IDS = Object.keys(THEMES)
const RENDER_MODES = ['SOLID', 'SECTION', 'SCHEMATIC']
const VIEW_NAMES = ['ISO', 'PLAN', 'FRONT', 'PROFILE', 'MACRO']

function App() {
  const [themeId, setThemeId] = useState('porcelain')
  const [renderMode, setRenderMode] = useState('SOLID')
  const [view, setView] = useState('ISO')
  const [orbit, setOrbit] = useState(true)
  const [tempo, setTempo] = useState(1)
  const [paused, setPaused] = useState(false)
  const [status, setStatus] = useState('RESTING')
  const [explode, setExplode] = useState(0)
  const [explodeTarget, setExplodeTarget] = useState(0)
  const [intro, setIntro] = useState(0)
  const [hoveredPart, setHoveredPart] = useState(null)
  const [selectedPart, setSelectedPart] = useState(null)
  const [labels, setLabels] = useState([])
  const [hidden, setHidden] = useState(false)
  const [telemetry, setTelemetry] = useState({
    depth: '4.70',
    verticalSpeed: '0.00',
    heading: '000°',
    pulse: '0.00',
    left: 0,
    right: 0,
    phase: 0,
  })
  const sequenceTimer = useRef(null)
  const statusRef = useRef(status)
  const introRef = useRef(intro)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    introRef.current = intro
  }, [intro])

  useEffect(() => {
    document.title = 'Medusa Mechanica — Articulated Pulsing Machine'
    const startedAt = performance.now()
    let frame
    const animate = (now) => {
      const linear = Math.min(1, (now - startedAt) / 4000)
      const eased =
        linear < 0.5
          ? 4 * linear * linear * linear
          : 1 - Math.pow(-2 * linear + 2, 3) / 2
      setIntro(eased)
      if (linear < 1) frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    let frame
    let previous = performance.now()
    const animate = (now) => {
      const delta = Math.min(0.04, (now - previous) / 1000)
      previous = now
      setExplode((current) => {
        const next = current + (explodeTarget - current) * (1 - Math.exp(-delta * 4.6))
        return Math.abs(next - explodeTarget) < 0.0005 ? explodeTarget : next
      })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [explodeTarget])

  useEffect(
    () => () => {
      if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current)
    },
    [],
  )

  const changeExplode = useCallback((value) => {
    setExplode(value)
    setExplodeTarget(value)
  }, [])

  const toggleExplode = useCallback(() => {
    setExplodeTarget((current) => (current > 0.5 ? 0 : 1))
    setSelectedPart(null)
  }, [])

  const handleLaunch = useCallback(() => {
    if (introRef.current < 0.9) return
    if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current)
    const current = statusRef.current
    if (current === 'RESTING') {
      setStatus('WARMING')
      sequenceTimer.current = window.setTimeout(() => setStatus('PULSING'), 1050)
      return
    }
    if (current === 'WARMING' || current === 'PULSING') {
      setStatus('SETTLING')
      sequenceTimer.current = window.setTimeout(() => setStatus('RESTING'), 2500)
    }
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      const key = event.key.toLowerCase()
      if (event.target instanceof HTMLInputElement) return
      if (event.target instanceof HTMLButtonElement && (key === ' ' || key === 'enter')) return
      if (key === 'f') handleLaunch()
      if (key === 'e') toggleExplode()
      if (key === 'h') setHidden((current) => !current)
      if (key === ' ') {
        event.preventDefault()
        setPaused((current) => !current)
      }
      if (key === 't') {
        setThemeId(
          (current) => THEME_IDS[(THEME_IDS.indexOf(current) + 1) % THEME_IDS.length],
        )
      }
      if (key === 'r') {
        setRenderMode(
          (current) =>
            RENDER_MODES[(RENDER_MODES.indexOf(current) + 1) % RENDER_MODES.length],
        )
      }
      const viewIndex = Number(event.key) - 1
      if (viewIndex >= 0 && viewIndex < VIEW_NAMES.length) setView(VIEW_NAMES[viewIndex])
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleLaunch, toggleExplode])

  const handleLabels = useCallback((nextLabels) => {
    setLabels(nextLabels)
  }, [])

  return (
    <main className={`app theme-${themeId} ${paused ? 'is-paused' : ''}`}>
      <MedusaScene
        themeId={themeId}
        renderMode={renderMode}
        view={view}
        orbit={orbit}
        tempo={paused ? 0 : tempo}
        status={status}
        explode={explode}
        intro={intro}
        hoveredPart={hoveredPart}
        setHoveredPart={setHoveredPart}
        selectedPart={selectedPart}
        setSelectedPart={setSelectedPart}
        onTelemetry={setTelemetry}
        onLabels={handleLabels}
      />
      <Interface
        themeId={themeId}
        setThemeId={setThemeId}
        intro={intro}
        status={status}
        explode={explode}
        setExplode={changeExplode}
        onLaunch={handleLaunch}
        view={view}
        setView={setView}
        renderMode={renderMode}
        setRenderMode={setRenderMode}
        orbit={orbit}
        setOrbit={setOrbit}
        tempo={tempo}
        setTempo={setTempo}
        hoveredPart={hoveredPart}
        setHoveredPart={setHoveredPart}
        selectedPart={selectedPart}
        setSelectedPart={setSelectedPart}
        telemetry={telemetry}
        labels={labels}
        hidden={hidden}
      />
      <div className={`pause-indicator ${paused && !hidden ? 'visible' : ''}`}>
        <span>II</span> SIMULATION PAUSED
      </div>
      <div className={`opening-curtain ${intro >= 1 ? 'complete' : ''}`}>
        <span>MM · III</span>
      </div>
    </main>
  )
}

export default App
