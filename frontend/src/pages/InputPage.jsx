import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { pageTransition, staggerList, fadeUp } from '../lib/animations'

const EXAMPLES = [
  'Does CRISPR-Cas9 efficiently edit plant cell genomes via Agrobacterium-mediated transformation?',
  'Can graphene oxide membranes selectively filter microplastics from freshwater samples?',
  "Do gut microbiome changes modulate Alzheimer's disease progression in murine models?",
]

function FlaskIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      {loading && <div className="load-bar" style={{ width: '60%' }} />}

      {/* Top nav */}
      <header style={{
        borderBottom: '1px solid var(--border-soft)',
        background: 'var(--bg-surface)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px', height: 44, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
            <FlaskIcon size={15} />
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              LabProcure
            </span>
          </div>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11, fontWeight: 500,
            padding: '2px 8px', borderRadius: 4,
            background: 'var(--bg-base)',
            border: '1px solid var(--border-soft)',
            color: 'var(--text-muted)',
          }}>
            v1.0
          </span>
        </div>
      </header>

      {/* Main */}
      <motion.main
        variants={pageTransition}
        initial="hidden"
        animate="visible"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' }}
      >
        <motion.div
          variants={staggerList}
          initial="hidden"
          animate="visible"
          style={{ width: '100%', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 32 }}
        >
{/* Heading */}
          <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <h1 style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 'clamp(1.875rem, 5vw, 2.75rem)',
              lineHeight: 1.12,
              letterSpacing: '-0.03em',
              color: 'var(--text-primary)',
            }}>
              Agentic Lab Procurement<br />
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>for Scientists</span>
            </h1>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.65, color: 'var(--text-muted)', maxWidth: 460 }}>
              LabProcure is an AI-powered platform that scientists use to autonomize their operative workflows from protocol design to lab procurement.
            </p>
          </motion.div>

          {/* Search form */}
          <motion.div variants={fadeUp}>
            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-soft)',
              borderRadius: 8,
            }}>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
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
                  placeholder={"Describe your hypothesis…\n\ne.g. Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points."}
                  rows={4}
                  style={{
                    minHeight: 112,
                    lineHeight: 1.65,
                    overflow: 'hidden',
                    resize: 'none',
                    border: 'none',
                    outline: 'none',
                    padding: '14px 16px 10px',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    background: 'transparent',
                    width: '100%',
                    letterSpacing: '-0.01em',
                  }}
                  disabled={loading}
                  autoFocus
                />
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px 10px',
                  borderTop: '1px solid var(--border-soft)',
                }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)' }}>
                    {wordCount > 0
                      ? <><strong style={{ color: 'var(--text-secondary)' }}>{wordCount}</strong> words</>
                      : 'Intervention · outcome · threshold'}
                    <span style={{ marginLeft: 10, opacity: 0.5, fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>⌘↵</span>
                  </span>
                  <motion.button
                    type="submit"
                    className="btn-primary"
                    style={{ padding: '6px 16px', fontSize: 13 }}
                    disabled={loading || !question.trim()}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    {loading ? 'Searching…' : 'Analyse →'}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>

          {error && (
            <motion.p
              variants={fadeUp}
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13,
                padding: '10px 14px', borderRadius: 6,
                color: 'var(--danger)',
                background: 'var(--danger-light)',
                border: '1px solid rgba(192,57,43,0.2)',
              }}
            >
              {error}
            </motion.p>
          )}

          {/* Examples */}
          <motion.div variants={fadeUp} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p className="section-label" style={{ marginBottom: 2 }}>Example hypotheses</p>
            {EXAMPLES.map((ex, i) => (
              <motion.button
                key={i}
                type="button"
                onClick={() => setQuestion(ex)}
                disabled={loading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  width: '100%', textAlign: 'left',
                  padding: '10px 14px', borderRadius: 6,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-soft)',
                  color: 'var(--text-secondary)',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 13, lineHeight: 1.55,
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--bg-hover)'
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.14)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--bg-surface)'
                  e.currentTarget.style.borderColor = 'var(--border-soft)'
                }}
              >
                {ex}
              </motion.button>
            ))}
          </motion.div>
        </motion.div>
      </motion.main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-soft)', background: 'var(--bg-surface)', padding: '10px 24px' }}>
        <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
            © 2026 LabProcure
          </span>
        </div>
      </footer>
    </div>
  )
}
