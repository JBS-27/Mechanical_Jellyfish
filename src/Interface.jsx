import { useMemo } from 'react'
import { PARTS, THEMES } from './data'

const VIEW_NAMES = ['ISO', 'PLAN', 'FRONT', 'PROFILE', 'MACRO']
const RENDER_NAMES = ['SOLID', 'SECTION', 'SCHEMATIC']

function RangeControl({ value, min = 0, max = 1, step = 0.01, onChange, label }) {
  const percentage = ((value - min) / (max - min)) * 100
  return (
    <label className="range-control">
      <span>{label}</span>
      <span className="range-track">
        <span className="range-fill" style={{ width: `${percentage}%` }} />
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
    </label>
  )
}

function ThemePicker({ themeId, setThemeId }) {
  return (
    <div className="theme-picker" aria-label="Theme">
      {Object.values(THEMES).map((theme) => (
        <button
          key={theme.id}
          type="button"
          className={`theme-choice ${themeId === theme.id ? 'active' : ''}`}
          onClick={() => setThemeId(theme.id)}
          aria-label={theme.name}
          title={theme.name}
        >
          <span
            className="theme-hex"
            style={{
              '--swatch-a': theme.swatch[0],
              '--swatch-b': theme.swatch[1],
              '--swatch-c': theme.swatch[2],
            }}
          />
          <span className="theme-name">{theme.name}</span>
        </button>
      ))}
    </div>
  )
}

function Status({ status, intro, explode, pulse }) {
  const assembly = intro < 1 ? Math.round(intro * 100) : Math.round((1 - explode) * 100)
  const pulseRate = Number(pulse)
  return (
    <div className="status-line">
      <span
        className={`status-dot ${status !== 'RESTING' ? 'active' : ''}`}
        style={{ animationDuration: pulseRate > 0 ? `${1 / pulseRate}s` : undefined }}
      />
      <span>{intro < 1 ? 'ASSEMBLING' : status}</span>
      <span className="status-divider">·</span>
      <span>ASSEMBLY {assembly} %</span>
    </div>
  )
}

function Oscilloscope({ telemetry }) {
  const width = 116
  const height = 31
  const samples = 34
  const left = []
  const right = []
  for (let index = 0; index < samples; index += 1) {
    const phase = ((index / (samples - 1) + telemetry.phase) % 1)
    const pulse = phase < 0.36
      ? Math.sin((phase / 0.36) * Math.PI * 0.5)
      : Math.pow(1 - (phase - 0.36) / 0.64, 2.2)
    const x = (index / (samples - 1)) * width
    left.push(`${x.toFixed(1)},${(height - 3 - pulse * telemetry.left * 13).toFixed(1)}`)
    right.push(`${x.toFixed(1)},${(height - 3 - pulse * telemetry.right * 13).toFixed(1)}`)
  }
  return (
    <svg className="oscilloscope" viewBox={`0 0 ${width} ${height}`} aria-label="Left and right contraction traces">
      <line x1="0" y1={height - 2} x2={width} y2={height - 2} className="scope-axis" />
      <polyline points={left.join(' ')} className="scope-left" />
      <polyline points={right.join(' ')} className="scope-right" />
    </svg>
  )
}

function Specification({ activePart, telemetry, status }) {
  const spec = PARTS[activePart] || PARTS.exumbrella
  const moving = status !== 'RESTING'
  return (
    <aside className="specification plate-panel">
      <div className="panel-kicker">SPECIFICATION · {String(Object.keys(PARTS).indexOf(activePart) + 1).padStart(2, '0')}</div>
      <h2>{spec.name}</h2>
      <p>{spec.function}</p>
      <div className="material-note">
        <span>MATERIAL</span>
        {spec.material}
      </div>
      <div className="biology-note">
        <span>BIOLOGY NOTE</span>
        {spec.fact}
      </div>
      <div className="primary-specs">
        <span><b>BELL Ø</b> 180 mm</span>
        <span><b>MASS</b> 42 g</span>
        <span><b>PULSE</b> 1.8 Hz</span>
        <span><b>AMPLITUDE</b> 28 %</span>
      </div>

      <div className={`telemetry ${moving ? 'visible' : ''}`}>
        <div className="telemetry-heading">
          <span>LIVE TELEMETRY</span>
          <span>CTRL · 04</span>
        </div>
        <div className="telemetry-grid">
          <span>DEPTH</span><b>{telemetry.depth} m</b>
          <span>VERT. SPEED</span><b>{telemetry.verticalSpeed} m/s</b>
          <span>HEADING</span><b>{telemetry.heading}</b>
          <span>PULSE</span><b>{telemetry.pulse} Hz</b>
          <span className="scope-label">L / R SECTOR</span>
          <Oscilloscope telemetry={telemetry} />
        </div>
      </div>
    </aside>
  )
}

function Labels({ labels, hoveredPart, selectedPart, setHoveredPart, setSelectedPart }) {
  return (
    <div className={`part-label-layer ${labels.length ? 'visible' : ''}`}>
      <svg className="leader-lines" width="100%" height="100%" aria-hidden="true">
        {labels.map((label) => {
          const lineEnd = label.labelX + (label.side === 'left' ? 88 : -88)
          const elbow = label.anchorX + (label.side === 'left' ? -28 : 28)
          return (
            <g key={label.id}>
              <polyline
                points={`${label.anchorX},${label.anchorY} ${elbow},${label.anchorY} ${lineEnd},${label.labelY}`}
                className={hoveredPart === label.id || selectedPart === label.id ? 'active' : ''}
              />
              <circle cx={label.anchorX} cy={label.anchorY} r="2.2" />
            </g>
          )
        })}
      </svg>
      {labels.map((label) => {
        const spec = PARTS[label.id]
        return (
          <button
            type="button"
            key={label.id}
            className={`part-label ${label.side} ${hoveredPart === label.id || selectedPart === label.id ? 'active' : ''}`}
            style={{ left: label.labelX, top: label.labelY }}
            onMouseEnter={() => setHoveredPart(label.id)}
            onMouseLeave={() => setHoveredPart(null)}
            onClick={() => setSelectedPart(label.id)}
          >
            <span>{spec.name}</span>
            <small>{spec.caption}</small>
          </button>
        )
      })}
    </div>
  )
}

function ControlBar({
  explode,
  setExplode,
  status,
  onLaunch,
  view,
  setView,
  renderMode,
  setRenderMode,
  orbit,
  setOrbit,
  tempo,
  setTempo,
}) {
  const launchLabel = status === 'RESTING' ? 'LAUNCH' : status === 'SETTLING' ? 'SETTLING' : 'SETTLE'
  return (
    <nav className="control-bar" aria-label="Medusa controls">
      <div className="control-section explode-control">
        <RangeControl value={explode} onChange={setExplode} label="ASSEMBLED" />
        <span className="range-end">EXPLODED</span>
      </div>
      <span className="control-separator" />
      <button
        type="button"
        className="launch-button"
        onClick={onLaunch}
        disabled={status === 'SETTLING'}
      >
        <span className="launch-icon">{status === 'RESTING' ? '↑' : '↓'}</span>
        {launchLabel}
      </button>
      <span className="control-separator" />
      <div className="control-section mode-control">
        <span className="control-label">VIEW</span>
        {VIEW_NAMES.map((name) => (
          <button
            type="button"
            key={name}
            className={view === name ? 'active' : ''}
            onClick={() => setView(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <span className="control-separator" />
      <div className="control-section mode-control render-control">
        <span className="control-label">RENDER</span>
        {RENDER_NAMES.map((name) => (
          <button
            type="button"
            key={name}
            className={renderMode === name ? 'active' : ''}
            onClick={() => setRenderMode(name)}
          >
            {name}
          </button>
        ))}
      </div>
      <span className="control-separator" />
      <button
        type="button"
        className={`orbit-toggle ${orbit ? 'active' : ''}`}
        onClick={() => setOrbit((current) => !current)}
      >
        <span>↻</span> ORBIT
      </button>
      <span className="control-separator" />
      <div className="control-section tempo-control">
        <RangeControl
          value={tempo}
          min={0.2}
          max={1.25}
          step={0.01}
          onChange={setTempo}
          label="TEMPO"
        />
        <output>{tempo.toFixed(2)}×</output>
      </div>
    </nav>
  )
}

function RegistrationMarks() {
  return (
    <div className="registration-marks" aria-hidden="true">
      <i className="top-left" />
      <i className="top-right" />
      <i className="bottom-left" />
      <i className="bottom-right" />
      <span className="edge-index top">180 · M3</span>
      <span className="edge-index right">PLATE 03 / 11</span>
    </div>
  )
}

export default function Interface({
  themeId,
  setThemeId,
  intro,
  status,
  explode,
  setExplode,
  onLaunch,
  view,
  setView,
  renderMode,
  setRenderMode,
  orbit,
  setOrbit,
  tempo,
  setTempo,
  hoveredPart,
  setHoveredPart,
  selectedPart,
  setSelectedPart,
  telemetry,
  labels,
  hidden,
}) {
  const theme = THEMES[themeId]
  const activePart = selectedPart || hoveredPart || 'exumbrella'
  const style = useMemo(
    () => ({
      '--theme-bg': theme.background,
      '--theme-bg-2': theme.background2,
      '--theme-ink': theme.ink,
      '--theme-muted': theme.muted,
      '--theme-accent': theme.metal,
      '--theme-line': theme.floor,
      '--theme-core': theme.core,
      '--theme-paper': theme.paper,
    }),
    [theme],
  )

  return (
    <div
      className={`interface ${intro > 0.9 ? 'introduced' : ''} ${hidden ? 'hidden' : ''}`}
      style={style}
    >
      <RegistrationMarks />
      <header className="title-block">
        <div className="figure-kicker">
          <span>FIG. III</span>
          <i />
          MEDUSA CNIDARIA
        </div>
        <h1><em>Medusa</em> Mechanica</h1>
        <div className="title-meta">CONCEPT Nº 11 · ARTICULATED PULSING MACHINE · 1 : 1 STUDY</div>
      </header>

      <div className="top-tools">
        <ThemePicker themeId={themeId} setThemeId={setThemeId} />
        <Status status={status} intro={intro} explode={explode} pulse={telemetry.pulse} />
      </div>

      <Specification activePart={activePart} telemetry={telemetry} status={status} />

      <div className={`schematic-annotations ${renderMode === 'SCHEMATIC' ? 'visible' : ''}`} aria-hidden="true">
        <span className="drawing-measure bell-dimension">Ø 180.0 mm</span>
        <span className="drawing-measure arm-dimension">118.0 mm</span>
        <span className="drawing-callout callout-a">03</span>
        <span className="drawing-callout callout-b">08</span>
        <span className="pulse-arc-note">R 14.2 · 28% STROKE</span>
      </div>

      <aside className="controls-legend plate-panel">
        <div className="panel-kicker">CONTROLS</div>
        <div className="legend-grid">
          <span><kbd>drag</kbd> orbit</span>
          <span><kbd>scroll</kbd> zoom</span>
          <span><kbd>right-drag</kbd> pan</span>
          <span><kbd>F</kbd> launch / settle</span>
          <span><kbd>E</kbd> explode</span>
          <span><kbd>T</kbd> theme</span>
          <span><kbd>R</kbd> render</span>
          <span><kbd>1–5</kbd> views</span>
          <span><kbd>space</kbd> pause</span>
          <span><kbd>H</kbd> hide UI</span>
        </div>
      </aside>

      <ControlBar
        explode={explode}
        setExplode={setExplode}
        status={status}
        onLaunch={onLaunch}
        view={view}
        setView={setView}
        renderMode={renderMode}
        setRenderMode={setRenderMode}
        orbit={orbit}
        setOrbit={setOrbit}
        tempo={tempo}
        setTempo={setTempo}
      />

      <Labels
        labels={labels}
        hoveredPart={hoveredPart}
        selectedPart={selectedPart}
        setHoveredPart={setHoveredPart}
        setSelectedPart={setSelectedPart}
      />
    </div>
  )
}
