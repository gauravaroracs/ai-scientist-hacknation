import { useState, useRef, useEffect } from 'react'

export default function InlineEdit({
  children,
  originalText,
  question,
  category,
  itemLabel = '',
  onSaved,
}) {
  const [hovered, setHovered]  = useState(false)
  const [editing, setEditing]  = useState(false)
  const [draft, setDraft]      = useState(originalText)
  const [comment, setComment]  = useState('')
  const [saving, setSaving]    = useState(false)
  const [saved, setSaved]      = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(draft.length, draft.length)
    }
  }, [editing])

  const handleSave = async () => {
    if (draft.trim() === originalText.trim()) { setEditing(false); return }
    setSaving(true)
    let success = false
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment_question: question, category, item_label: itemLabel, original_text: originalText, corrected_text: draft.trim(), comment: comment.trim() }),
      })
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(`Save failed ${res.status}: ${body.detail || 'unknown error'}`) }
      success = true
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error('InlineEdit save error:', err)
    } finally {
      setSaving(false); setEditing(false); setComment('')
      onSaved?.(draft.trim(), success)
    }
  }

  const handleCancel = () => { setEditing(false); setDraft(originalText); setComment('') }

  if (editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 6, border: '1px solid rgba(0,0,0,0.2)', background: 'var(--bg-base)' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.max(3, Math.ceil(draft.length / 80))}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.65,
            padding: '8px 10px', borderRadius: 5,
            border: '1px solid var(--border-soft)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            resize: 'none', outline: 'none', width: '100%',
            letterSpacing: '-0.01em',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.22)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-soft)'}
        />
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Why this correction? (optional)"
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12,
            padding: '6px 10px', borderRadius: 5,
            border: '1px solid var(--border-soft)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)', outline: 'none', width: '100%',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.22)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-soft)'}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
            style={{ padding: '5px 14px', fontSize: 12 }}
          >
            {saving ? 'Saving…' : 'Save Correction'}
          </button>
          <button onClick={handleCancel} className="btn-ghost" style={{ padding: '5px 14px', fontSize: 12 }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 5,
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        outline: hovered ? '1px solid var(--border-soft)' : '1px solid transparent',
        transition: 'background 0.15s, outline 0.15s',
        padding: '1px 3px',
        position: 'relative',
      }}
    >
      {saved && (
        <span style={{
          position: 'absolute', right: 2, top: 2,
          fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
          padding: '1px 7px', borderRadius: 4,
          background: 'rgba(45,122,58,0.08)',
          color: 'var(--diff-add)',
          border: '1px solid rgba(45,122,58,0.2)',
          zIndex: 10, whiteSpace: 'nowrap',
        }}>
          ✓ Saved
        </span>
      )}

      {children}

      {/* Always-visible edit button — subtle at rest, clear on hover/touch */}
      {!saved && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          onTouchStart={() => setHovered(true)}
          title="Tap to edit"
          style={{
            position: 'absolute', top: 2, right: 2,
            background: hovered ? 'var(--bg-surface)' : 'transparent',
            border: `1px solid ${hovered ? 'var(--border-soft)' : 'transparent'}`,
            borderRadius: 5,
            padding: '2px 6px',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4,
            color: hovered ? 'var(--text-secondary)' : 'var(--text-muted)',
            fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 500,
            opacity: hovered ? 1 : 0.35,
            zIndex: 10,
            transition: 'opacity 0.15s, background 0.15s, border-color 0.15s',
          }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          {hovered && 'Edit'}
        </button>
      )}
    </div>
  )
}
