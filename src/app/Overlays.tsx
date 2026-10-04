import { useEffect, useState, type ReactNode } from 'react'
import { t } from '../i18n'
import { runProbe, type ProbeResult } from '../diag/probe'

// Overlay sheets (04-componentes.md · Hoja superpuesta): veil, sheet up to 560 px,
// reading text. Escape or tapping the veil closes them.

function Overlay({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="overlay-sheet" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  )
}

export function GuideSheet({ onClose }: { onClose: () => void }) {
  return (
    <Overlay label={t('guide.title')} onClose={onClose}>
      <h2 className="overlay-title">{t('guide.title')}</h2>
      <ol className="guide-steps">
        <li>{t('guide.step1')}</li>
        <li>{t('guide.step2')}</li>
        <li>{t('guide.step3')}</li>
        <li>{t('guide.step4')}</li>
      </ol>
      <button type="button" className="wide-btn dark" onClick={onClose}>{t('guide.close')}</button>
    </Overlay>
  )
}

/** Phase 00 spike report (open the app with #diag). */
export function DiagSheet({ onClose }: { onClose: () => void }) {
  const [results, setResults] = useState<ProbeResult[] | null>(null)
  useEffect(() => {
    let alive = true
    runProbe().then((r) => {
      if (!alive) return
      setResults(r)
      console.table(r)
    })
    return () => { alive = false }
  }, [])
  return (
    <Overlay label={t('diag.title')} onClose={onClose}>
      <h2 className="overlay-title">{t('diag.title')}</h2>
      {!results && <p>{t('diag.running')}</p>}
      {results && (
        <ul className="diag-list">
          {results.map((r) => (
            <li key={r.id}>
              <span className="label diag-state">{r.ok ? t('diag.ok') : t('diag.fail')}</span>
              <span>{r.label}{r.detail && <small>{r.detail}</small>}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="wide-btn dark" onClick={onClose}>{t('guide.close')}</button>
    </Overlay>
  )
}
