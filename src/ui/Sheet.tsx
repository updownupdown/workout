import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

export function Sheet({
  onClose, children, title, className = '',
}: { onClose: () => void; children: ReactNode; title?: string; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className={`sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grab" />
        {title && (
          <header className="sheet-head">
            <h2>{title}</h2>
            <button className="icon-btn ghost" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </header>
        )}
        {children}
      </div>
    </div>
  )
}
