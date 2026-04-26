import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXAMPLES = [
  'Does CRISPR-Cas9 efficiently edit plant cell genomes via Agrobacterium-mediated transformation?',
  'Can graphene oxide membranes selectively filter microplastics from freshwater samples?',
  "Do gut microbiome changes modulate Alzheimer's disease progression in murine models?",
]

function BeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
    </svg>
  )
}

export default function InputPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/literature-qc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const data = await res.json()
      navigate('/qc', { state: { qcResult: data, question: question.trim() } })
    } catch (err) {
      setError(err.message || 'Failed to reach server. Is the backend running?')
      setLoading(false)
    }
  }

  const wordCount = question.trim().length > 0 ? question.trim().split(/\s+/).length : 0

  return (
    <div className="dot-bg min-h-screen flex flex-col">
      {loading && <div className="load-bar" />}

      {/* Top nav */}
      <header
        className="w-full border-b"
        style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 50 }}
      >
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5" style={{ color: 'var(--accent)' }}>
            <BeakerIcon />
            <span className="font-display font-semibold text-base" style={{ color: 'var(--ink)' }}>
              The AI Scientist
            </span>
          </div>
          <span
            className="font-mono text-xs px-2.5 py-1 rounded-full"
            style={{ color: 'var(--muted)', background: 'var(--surface2)', border: '1px solid var(--border)' }}
          >
            v1.0
          </span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-2xl flex flex-col items-center gap-10 stagger">

          {/* Badge */}
          <div
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: 'var(--accent)' }}
            />
            Global AI Hackathon 2026
          </div>

          {/* Heading */}
          <div className="text-center flex flex-col gap-4">
            <h1
              className="font-display font-bold leading-[1.08]"
              style={{ color: 'var(--ink)', fontSize: 'clamp(2.5rem, 6vw, 3.75rem)' }}
            >
              From Hypothesis to<br />
              <em style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
                Runnable Experiment
              </em>
            </h1>
            <p
              className="font-sans text-lg leading-relaxed"
              style={{ color: 'var(--muted)', maxWidth: 460, margin: '0 auto' }}
            >
              Enter a scientific question. We check prior literature, then generate a complete, operationally grounded lab protocol.
            </p>
          </div>

          {/* Search form — card container */}
          <div
            className="w-full card"
            style={{ padding: '6px 6px 6px 6px', boxShadow: 'var(--shadow-lg)' }}
          >
            <form onSubmit={handleSubmit} className="flex flex-col">
              <textarea
                value={question}
                onChange={(e) => {
                  setQuestion(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
                }}
                placeholder={"Describe your hypothesis in detail…\n\ne.g. Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points."}
                rows={4}
                style={{
                  minHeight: 120,
                  lineHeight: 1.75,
                  overflow: 'hidden',
                  resize: 'none',
                  border: 'none',
                  outline: 'none',
                  padding: '16px 18px 12px',
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '1rem',
                  color: 'var(--ink)',
                  background: 'transparent',
                  width: '100%',
                }}
                disabled={loading}
                autoFocus
              />
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ borderTop: '1px solid var(--border-light)' }}
              >
                <span className="font-sans text-xs" style={{ color: 'var(--subtle)' }}>
                  {wordCount > 0
                    ? <><strong style={{ color: 'var(--muted)' }}>{wordCount}</strong> words</>
                    : 'Name the intervention, outcome, and threshold'}
                  <span className="ml-3 opacity-50">⌘↵ to submit</span>
                </span>
                <button
                  type="submit"
                  className="btn-primary px-6 py-2 rounded-lg text-sm whitespace-nowrap"
                  disabled={loading || !question.trim()}
                >
                  {loading ? 'Searching…' : 'Analyse →'}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <p
              className="w-full font-sans text-sm px-4 py-3 rounded-lg"
              style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid #FECACA' }}
            >
              {error}
            </p>
          )}

          {/* Example prompts */}
          <div className="w-full flex flex-col gap-2.5">
            <p className="section-label">Example hypotheses</p>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuestion(ex)}
                disabled={loading}
                className="w-full text-left px-4 py-3 rounded-xl transition-all"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--body)',
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-xs)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-mid)'
                  e.currentTarget.style.background = 'var(--accent-light)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'var(--surface)'
                  e.currentTarget.style.color = 'var(--body)'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-center">
          <span className="font-sans text-xs" style={{ color: 'var(--subtle)' }}>
            Hack-Nation × World Bank Youth Summit · Global AI Hackathon 2026
          </span>
        </div>
      </footer>
    </div>
  )
}
