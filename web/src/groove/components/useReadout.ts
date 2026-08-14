import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParamSpec } from '../types'

export interface Readout {
  value: { label: string; value: string } | null
  show: (spec: ParamSpec, v: number) => void
}

/** Shows the last touched control on a panel display, then fades back. */
export function useReadout(holdMs = 1600): Readout {
  const [value, setValue] = useState<{ label: string; value: string } | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const show = useCallback(
    (spec: ParamSpec, v: number) => {
      setValue({ label: spec.label, value: spec.format ? spec.format(v) : v.toFixed(2) })
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setValue(null), holdMs)
    },
    [holdMs],
  )

  return { value, show }
}
