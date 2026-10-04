import { useCallback, useRef, useState } from 'react'

export const NOTICE_MS = 1400

/** The kit's short notice: one line on the card, gone after 1.4 s. */
export function useNotice(): [string, (text: string) => void] {
  const [text, setText] = useState('')
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    setText(next)
    timer.current = window.setTimeout(() => setText(''), NOTICE_MS)
  }, [])
  return [text, show]
}
