import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'

// ── Overlay ────────────────────────────────────────────────────────────────────
function PlanGeneratingOverlay({ stage, progress }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(245,247,252,0.92)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 36,
    }}>
      <div style={{ position: 'relative', width: 68, height: 68 }}>
        <svg width="68" height="68" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
          <path d="M6.5 17.5s1-.5 2.5-.5 2.5.5 4 .5 2.5-.5 2.5-.5" stroke="var(--teal)" strokeWidth="1.2"/>
        </svg>
        <div style={{
          position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)',
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--teal)',
          animation: 'genBounce 1s ease-in-out infinite',
        }} />
      </div>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <h2 className="font-display font-bold mb-2" style={{ color: 'var(--ink)', fontSize: '1.5rem' }}>
          Generating Experiment Plan
        </h2>
        <p className="font-sans text-sm" style={{ color: 'var(--muted)', minHeight: 20, transition: 'all 0.4s' }}>
          {stage || 'Initialising…'}
        </p>
      </div>
      <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--teal))',
            borderRadius: 99, transition: 'width 0.5s ease',
          }} />
        </div>
        <div className="flex justify-between">
          <span className="font-sans text-xs" style={{ color: 'var(--muted)' }}>
            This typically takes 30–60 seconds
          </span>
          <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
      <style>{`
        @keyframes genBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-7px); }
        }
      `}</style>
    </div>
  )
}

// ── Novelty config ─────────────────────────────────────────────────────────────
const NOVELTY_CONFIG = {
  'not found': {
    label: 'Novel — No Prior Protocol Found',
    color: 'var(--success)', bg: 'var(--success-light)', border: '#A7F3D0',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    description: 'No existing protocols match this hypothesis. This appears to be unexplored territory — proceed with confidence.',
  },
  'similar work exists': {
    label: 'Similar Work Exists',
    color: 'var(--warning)', bg: 'var(--warning-light)', border: '#FCD34D',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    description: 'Related or adjacent protocols have been published. Review the references before generating your plan.',
  },
  'exact match found': {
    label: 'Exact Match Found',
    color: 'var(--danger)', bg: 'var(--danger-light)', border: '#FCA5A5',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    description: 'An existing protocol closely matches this hypothesis. Consider refining your research question to establish greater novelty.',
  },
}

const LIT_SUGGESTIONS = [
  'What are the key findings across these papers?',
  'How novel is this hypothesis vs. existing work?',
  'What methodologies have been used?',
  'What gaps exist in the literature?',
]

// ── Inline chat panel ──────────────────────────────────────────────────────────
function LitChatPanel({ question, papers, references, novelty_signal }) {
  const litContext = {
    question,
    novelty_signal,
    references: references || [],
    papers: (papers || []).map(p => ({
      title: p.title, year: p.year, venue: p.venue,
      citation_count: p.citation_count, abstract: p.abstract,
    })),
  }

  const [inputValue, setInputValue] = useState('')
  const transportRef = useRef(new TextStreamChatTransport({ api: '/api/chat' }))
  const { messages, sendMessage, status } = useChat({
    transport: transportRef.current,
  })
  const isLoading = status === 'streaming' || status === 'submitted'


  const submit = (text) => {
    const msg = text ?? inputValue
    if (!msg?.trim() || isLoading) return
    sendMessage({ text: msg.trim() }, { body: { context: litContext } })
    setInputValue('')
  }

  const sendSuggestion = (text) => {
    submit(text)
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%',
      background: 'var(--surface)',
    }}>
      {/* Panel header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 9,
          background: 'var(--accent-light)',
          border: '1.5px solid var(--accent-mid)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
          </svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
            Literature Q&amp;A
          </p>
          <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: 'var(--muted)' }}>
            {papers?.length > 0 ? `${papers.length} paper${papers.length !== 1 ? 's' : ''} in context` : 'Ask about the retrieved papers'}
          </p>
        </div>
        {isLoading && (
          <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 }}>
            {[0,1,2].map(i => (
              <span key={i} style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--accent)', display: 'inline-block',
                animation: `litBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{
              fontFamily: "'Source Sans 3', sans-serif", fontSize: 12,
              color: 'var(--muted)', textAlign: 'center', padding: '8px 0',
            }}>
              Ask questions about the retrieved papers and literature
            </p>
            {LIT_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => sendSuggestion(s)}
                style={{
                  fontFamily: "'Source Sans 3', sans-serif",
                  fontSize: 12, textAlign: 'left',
                  padding: '9px 12px', borderRadius: 10,
                  background: 'var(--surface2)',
                  border: '1px solid var(--border)',
                  color: 'var(--body)', cursor: 'pointer',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--accent-light)'
                  e.currentTarget.style.borderColor = 'var(--accent-mid)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface2)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          messages.map(m => {
            const text = m.parts
              ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('')
              : (m.content ?? '')
            return (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '88%', padding: '9px 13px',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                color: m.role === 'user' ? 'white' : 'var(--ink)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}>
                {text}
              </div>
            </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        style={{
          padding: '12px 14px',
          borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, flexShrink: 0,
          background: 'var(--surface)',
        }}
      >
        <input
          id="lit-chat-input"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Ask about these papers…"
          disabled={isLoading}
          style={{
            flex: 1, padding: '9px 13px',
            borderRadius: 10,
            border: '1.5px solid var(--border)',
            background: 'var(--surface2)',
            color: 'var(--ink)', outline: 'none',
            fontFamily: "'Source Sans 3', sans-serif",
            fontSize: 13, transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />
        <button
          type="submit"
          disabled={isLoading || !inputValue?.trim()}
          style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            background: isLoading || !inputValue?.trim() ? 'var(--surface2)' : 'var(--accent)',
            border: '1.5px solid var(--border)',
            cursor: isLoading || !inputValue?.trim() ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, box-shadow 0.15s',
            boxShadow: isLoading || !inputValue?.trim() ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={isLoading || !inputValue?.trim() ? 'var(--muted)' : 'white'}
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>

      <style>{`
        @keyframes litBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function QCPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { qcResult, question } = location.state || {}

  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [stage, setStage]       = useState('')
  const [progress, setProgress] = useState(0)

  if (!qcResult || !question) {
    return (
      <div className="dot-bg min-h-screen flex items-center justify-center">
        <div className="card p-8 text-center flex flex-col gap-4 items-center" style={{ maxWidth: 360 }}>
          <p className="font-sans text-sm" style={{ color: 'var(--muted)' }}>No QC data found.</p>
          <Link to="/" className="btn-primary px-5 py-2 rounded-lg text-sm">← Start over</Link>
        </div>
      </div>
    )
  }

  const cfg = NOVELTY_CONFIG[qcResult.novelty_signal] || NOVELTY_CONFIG['similar work exists']

  const handleProceed = async () => {
    setLoading(true)
    setError('')
    setStage('')
    setProgress(0)
    try {
      const res = await fetch('http://localhost:8000/generate-plan/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          literature_context: qcResult.context_summary || '',
          references: qcResult.references || [],
        }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.stage === 'error') throw new Error(data.message)
          if (data.stage === 'done') {
            navigate('/plan', { state: { plan: data.plan, question, correctionsApplied: data.corrections_applied ?? 0 } })
            return
          }
          flushSync(() => { setStage(data.stage); setProgress(data.pct) })
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate plan.')
      setLoading(false)
    }
  }

  const headerHeight = 53 // px — keep in sync with header py+font

  return (
    <div className="dot-bg min-h-screen flex flex-col">
      {loading && <PlanGeneratingOverlay stage={stage} progress={progress} />}

      {/* Header */}
      <header
        className="w-full border-b flex-shrink-0"
        style={{
          borderColor: 'var(--border)',
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(8px)',
          position: 'sticky', top: 0, zIndex: 50,
        }}
      >
        <div className="px-6 py-3 flex items-center gap-2.5">
          <Link to="/" className="flex items-center gap-2 group" style={{ color: 'var(--accent)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
            <span className="font-display font-semibold text-sm group-hover:underline" style={{ color: 'var(--ink)' }}>
              The AI Scientist
            </span>
          </Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--border)' }}>
            <polyline points="9 18 15 12 9 6"/>
          </svg>
          <span className="font-sans text-sm font-semibold" style={{ color: 'var(--muted)' }}>Literature QC</span>
        </div>
      </header>

      {/* Two-column body */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, height: `calc(100vh - ${headerHeight}px)` }}>

        {/* ── Left: literature content ── */}
        <div style={{
          flex: 1, overflowY: 'auto',
          padding: '32px 40px',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <div className="w-full flex flex-col gap-4 stagger" style={{ maxWidth: 640 }}>

            {/* Hypothesis */}
            <div className="card px-5 py-4">
              <p className="section-label mb-2">Hypothesis</p>
              <p className="font-display text-xl font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                "{question}"
              </p>
            </div>

            {/* Novelty signal */}
            <div
              className="card px-5 py-4 flex items-start gap-4"
              style={{ borderColor: cfg.border, background: cfg.bg, boxShadow: 'none' }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: 'white', border: `1.5px solid ${cfg.border}`, color: cfg.color }}
              >
                {cfg.icon}
              </div>
              <div className="flex flex-col gap-1.5">
                <p className="font-sans font-bold text-sm" style={{ color: cfg.color }}>{cfg.label}</p>
                <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--body)' }}>{cfg.description}</p>
              </div>
            </div>

            {/* References */}
            {qcResult.references?.length > 0 && (
              <div className="card px-5 py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Retrieved References</p>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {qcResult.references.length}
                  </span>
                </div>
                <ul className="flex flex-col gap-2">
                  {qcResult.references.map((url, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <span className="font-mono text-xs mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-md"
                        style={{ color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid var(--accent-mid)' }}>
                        {i + 1}
                      </span>
                      <a href={url} target="_blank" rel="noopener noreferrer"
                        className="font-sans text-sm break-all hover:underline" style={{ color: 'var(--accent)' }}>
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Literature snapshot */}
            {qcResult.papers?.length > 0 && (
              <div className="card px-5 py-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="section-label">Literature Snapshot</p>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                    {qcResult.papers.length} paper{qcResult.papers.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {qcResult.papers.map((paper, i) => (
                    <div key={i} className="flex flex-col gap-2 px-4 py-3.5 rounded-xl"
                      style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}>
                      <div className="flex items-start gap-2.5">
                        <span className="flex-shrink-0 font-mono text-xs px-1.5 py-0.5 rounded-md mt-0.5"
                          style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid var(--accent-mid)' }}>
                          {i + 1}
                        </span>
                        {paper.url ? (
                          <a href={paper.url} target="_blank" rel="noopener noreferrer"
                            className="font-sans text-sm font-semibold leading-snug hover:underline" style={{ color: 'var(--ink)' }}>
                            {paper.title}
                          </a>
                        ) : (
                          <p className="font-sans text-sm font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
                            {paper.title}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 pl-7">
                        {paper.year && (
                          <span className="font-mono text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                            {paper.year}
                          </span>
                        )}
                        {paper.venue && (
                          <span className="font-sans text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                            {paper.venue}
                          </span>
                        )}
                        {paper.citation_count > 0 && (
                          <span className="font-sans text-xs px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                            {paper.citation_count.toLocaleString()} citations
                          </span>
                        )}
                      </div>
                      {paper.abstract && (
                        <p className="font-sans text-xs leading-relaxed pl-7" style={{ color: 'var(--body)' }}>
                          {paper.abstract}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="font-sans text-sm px-4 py-3 rounded-xl"
                style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid #FECACA' }}>
                {error}
              </p>
            )}

            <button
              onClick={handleProceed}
              disabled={loading}
              className="btn-primary w-full py-3.5 rounded-xl text-base"
            >
              Proceed to Plan Generation →
            </button>

            <p className="font-sans text-xs text-center" style={{ color: 'var(--subtle)' }}>
              Plan generation uses GPT-4o with structured output and may take up to a minute.
            </p>
          </div>
        </div>

        {/* ── Right: inline chat panel ── */}
        <div style={{
          width: 380,
          flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--surface)',
          position: 'sticky',
          top: headerHeight,
          height: `calc(100vh - ${headerHeight}px)`,
        }}>
          <LitChatPanel
            question={question}
            papers={qcResult.papers}
            references={qcResult.references}
            novelty_signal={qcResult.novelty_signal}
          />
        </div>
      </div>
    </div>
  )
}
