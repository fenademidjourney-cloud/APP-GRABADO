import { t } from '../i18n'
import { IconButton, Pill } from '../ui/kit'
import { IconFrame, IconRedo, IconRoller, IconSave, IconShare, IconUndo } from '../ui/icons'
import type { Mode } from './prefs'

// Header: brand · mode pill · history pill · export · share (03-anatomia-y-layout.md).
// Undo, redo, export and share act on the document; they stay disabled (30 %) until
// there is something to act on.

export function Header({ mode, onMode, canUndo, canRedo, canExport, onUndo, onRedo, onExport, onShare }: {
  mode: Mode
  onMode: (m: Mode) => void
  canUndo: boolean
  canRedo: boolean
  canExport: boolean
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  onShare: () => void
}) {
  return (
    <header className="hdr">
      <h1 className="brand"><span>{t('brand.line1')}</span><span>{t('brand.line2')}</span></h1>
      <Pill label={t('mode.group')}>
        <IconButton label={t('mode.compose')} active={mode === 'compose'} onClick={() => onMode('compose')}><IconFrame size={19} /></IconButton>
        <IconButton label={t('mode.print')} active={mode === 'print'} onClick={() => onMode('print')}><IconRoller size={19} /></IconButton>
      </Pill>
      <Pill label={t('history.group')}>
        <IconButton label={t('history.undo')} disabled={!canUndo} onClick={onUndo}><IconUndo size={17} /></IconButton>
        <IconButton label={t('history.redo')} disabled={!canRedo} onClick={onRedo}><IconRedo size={17} /></IconButton>
      </Pill>
      <IconButton className="solo" label={t('header.export')} disabled={!canExport} onClick={onExport}><IconSave size={19} /></IconButton>
      <IconButton className="solo" label={t('header.share')} disabled={!canExport} onClick={onShare}><IconShare size={19} /></IconButton>
    </header>
  )
}
