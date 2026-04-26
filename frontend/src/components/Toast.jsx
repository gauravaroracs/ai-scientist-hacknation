import { useEffect, useState } from 'react'

/**
 * Usage: <Toast message="Saved!" type="success" onDone={() => setToast(null)} />
 * type: 'success' | 'error'
 */
export default function Toast({ message, type = 'success', onDone }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(onDone, 300)
    }, 3000)
    return () => clearTimeout(t)
  }, [])

  const colors = type === 'success'
    ? { bg: '#ECFDF5', border: '#A7F3D0', color: '#059669' }
    : { bg: '#FEF2F2', border: '#FECACA', color: '#DC2626' }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.color,
        borderRadius: 10,
        padding: '10px 16px',
        fontFamily: "'Source Sans 3', sans-serif",
        fontSize: 14,
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.3s, transform 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        maxWidth: 340,
      }}
    >
      {type === 'success' ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
      {message}
    </div>
  )
}
