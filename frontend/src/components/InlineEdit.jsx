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
    if (draft.trim() === originalText.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experiment_question: question,
          category,
          item_label:     itemLabel,
          original_text:  originalText,
          corrected_text: draft.trim(),
          comment:        comment.trim(),
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
      onSaved?.(draft.trim())
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
      setEditing(false)
      setComment('')
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setDraft(originalText)
    setComment('')
  }

  if (editing) {
    return (
      <div
        className="flex flex-col gap-2 p-3 rounded-xl"
        style={{ border: '1.5px solid var(--accent)', background: 'var(--accent-light)' }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={Math.max(3, Math.ceil(draft.length / 80))}
          className="sci-input p-2 text-sm resize-none rounded-lg"
          style={{ fontFamily: "'Source Sans 3', sans-serif", lineHeight: 1.65 }}
        />
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Why this correction? (optional — helps train future plans)"
          className="sci-input px-3 py-1.5 text-xs rounded-lg"
          style={{ fontFamily: "'Source Sans 3', sans-serif" }}
        />
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-4 py-1.5 text-xs rounded-lg"
          >
            {saving ? 'Saving…' : 'Save Correction'}
          </button>
          <button onClick={handleCancel} className="btn-ghost px-4 py-1.5 text-xs rounded-lg">
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
        borderRadius: 8,
        background: hovered ? 'var(--accent-light)' : 'transparent',
        outline: hovered ? '1.5px solid var(--accent-mid)' : '1.5px solid transparent',
        transition: 'background 0.15s, outline 0.15s',
        padding: '2px 4px',
      }}
    >
      {saved && (
        <span
          className="absolute right-0 top-0 font-sans text-xs px-2 py-0.5 rounded-md"
          style={{
            background: 'var(--success-light)',
            color: 'var(--success)',
            border: '1px solid #A7F3D0',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          ✓ Saved
        </span>
      )}

      {children}

      {hovered && !saved && (
        <button
          onClick={() => setEditing(true)}
          title="Suggest a correction"
          style={{
            position: 'absolute',
            top: 2, right: 2,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            padding: '2px 7px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--muted)',
            fontSize: 11,
            fontFamily: "'Source Sans 3', sans-serif",
            fontWeight: 600,
            boxShadow: 'var(--shadow-xs)',
            zIndex: 10,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
      )}
    </div>
  )
}
