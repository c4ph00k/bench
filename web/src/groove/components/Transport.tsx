import { useCallback, useRef } from 'react'
import type { Patch } from '../types'
import { Knob } from './Knob'
import { LedStrip } from './LedStrip'

interface Props {
  patches: Patch[]
  index: number
  onSelect: (i: number) => void
  playing: boolean
  onPlay: () => void
  bpm: number
  onBpm: (v: number) => void
  swing: number
  onSwing: (v: number) => void
  current: number
  edited: boolean
  onRevert: () => void
}

function TempoDial({ bpm, onBpm }: { bpm: number; onBpm: (v: number) => void }) {
  const drag = useRef<{ y: number; start: number } | null>(null)
  const down = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as Element).setPointerCapture(e.pointerId)
      drag.current = { y: e.clientY, start: bpm }
    },
    [bpm],
  )
  const move = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current
      if (!d) return
      const next = d.start + (d.y - e.clientY) / (e.shiftKey ? 12 : 3)
      onBpm(Math.max(60, Math.min(180, Math.round(next))))
    },
    [onBpm],
  )
  const up = useCallback(() => {
    drag.current = null
  }, [])

  return (
    <div className="tempo">
      <button type="button" className="tempo-step" onClick={() => onBpm(Math.max(60, bpm - 1))}>
        −
      </button>
      <div
        className="tempo-read"
        title="Drag up/down to change tempo"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        <span className="tempo-value">{bpm}</span>
        <span className="tempo-unit">BPM</span>
      </div>
      <button type="button" className="tempo-step" onClick={() => onBpm(Math.min(180, bpm + 1))}>
        +
      </button>
    </div>
  )
}

export function Transport(p: Props) {
  return (
    <header className="transport">
      <a className="home-link" href="/" aria-label="Home">
        HOME
      </a>
      <div className="brand">
        <span className="brand-mark" />
        <span className="brand-name">GROOVEBOX</span>
        <span className="brand-model">GX-4</span>
      </div>

      <button
        type="button"
        className={`play-btn${p.playing ? ' playing' : ''}`}
        title="Spacebar"
        onClick={p.onPlay}
      >
        <span className="play-glyph">{p.playing ? '■' : '▶'}</span>
        {p.playing ? 'STOP' : 'PLAY'}
      </button>

      <TempoDial bpm={p.bpm} onBpm={p.onBpm} />

      <div className="swing-bank">
        <Knob
          spec={{ key: 'swing', label: 'SWING', kind: 'knob', min: 0, max: 1 }}
          value={p.swing}
          onChange={p.onSwing}
        />
      </div>

      <div className="master-leds">
        <LedStrip current={p.current} />
        <span className="master-leds-label">STEP</span>
      </div>

      <div className="patch-bank">
        {p.patches.map((patch, i) => (
          <button
            key={patch.name}
            type="button"
            className={`patch-btn${i === p.index ? ' active' : ''}`}
            title={`${patch.name} — ${patch.subtitle} (key ${i + 1})`}
            onClick={() => p.onSelect(i)}
          >
            <span className="patch-slot">{'ABCD'[i]}</span>
            <span className="patch-text">
              <span className="patch-name">{patch.name}</span>
              <span className="patch-sub">{patch.subtitle}</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          className="revert-btn"
          onClick={p.onRevert}
          disabled={!p.edited}
          title="Restore this patch to its factory settings"
        >
          {p.edited ? 'REVERT' : 'SAVED'}
        </button>
      </div>
    </header>
  )
}
