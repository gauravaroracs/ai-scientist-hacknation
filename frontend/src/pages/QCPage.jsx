import { useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useLocation, Link } from 'react-router-dom'


function PlanGeneratingOverlay({ stage, progress }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(248,250,252,0.92)',
        backdropFilter: 'blur(6px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32,
      }}
    >
      {/* Animated beaker icon */}
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
          <path d="M6.5 17.5s1-.5 2.5-.5 2.5.5 4 .5 2.5-.5 2.5-.5" stroke="var(--teal)" strokeWidth="1.2"/>
        </svg>
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--accent)',
          animation: 'bounce 1s ease-in-out infinite',
        }} />
      </div>

      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <h2 className="font-display text-2xl font-bold mb-2" style={{ color: 'var(--ink)' }}>
          Generating Your Experiment Plan
        </h2>
        <p className="font-sans text-sm" style={{ color: 'var(--muted)', minHeight: 20, transition: 'all 0.4s' }}>
          {stage || 'Initialising…'}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--accent), var(--teal))',
            borderRadius: 99,
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div className="flex justify-end">
          <span className="font-mono text-xs" style={{ color: 'var(--muted)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <p className="font-sans text-xs" style={{ color: 'var(--muted)', opacity: 0.7 }}>
        This typically takes 30–60 seconds
      </p>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </div>
  )
}

const NOVELTY_CONFIG = {
  'not found': {
    label: 'Novel — No Prior Protocol Found',
    color: 'var(--success)',
    bg: 'var(--success-light)',
    border: '#6ee7b7',
    dot: '#059669',
    description:
      'No existing protocols match this hypothesis in the searched repositories. This appears to be unexplored territory — proceed with confidence.',
  },
  'similar work exists': {
    label: 'Similar Work Exists',
    color: 'var(--warning)',
    bg: 'var(--warning-light)',
    border: '#fcd34d',
    dot: '#d97706',
    description:
      'Related or adjacent protocols have been published. Review the references below to understand existing approaches before generating your plan.',
  },
  'exact match found': {
    label: 'Exact Match Found',
    color: 'var(--danger)',
    bg: 'var(--danger-light)',
    border: '#fca5a5',
    dot: '#dc2626',
    description:
      'An existing protocol closely matches this hypothesis. Consider refining your research question to establish greater novelty.',
  },
}

export default function QCPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
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
          <Link to="/" className="btn-primary px-5 py-2 rounded text-sm">← Start over</Link>
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
        buffer = lines.pop() // keep incomplete line
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.stage === 'error') throw new Error(data.message)
          if (data.stage === 'done') {
            navigate('/plan', { state: { plan: data.plan, question } })
            return
          }
          flushSync(() => {
            setStage(data.stage)
            setProgress(data.pct)
          })
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate plan.')
      setLoading(false)
    }
  }

  return (
    <div className="dot-bg min-h-screen flex flex-col">
      {loading && <PlanGeneratingOverlay stage={stage} progress={progress} />}

      {/* Top nav */}
      <header className="w-full border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
              <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
            </svg>
            <span className="font-display font-semibold text-sm" style={{ color: 'var(--ink)' }}>The AI Scientist</span>
          </Link>
          <span style={{ color: 'var(--border)' }}>›</span>
          <span className="font-sans text-sm" style={{ color: 'var(--muted)' }}>Literature QC</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-2xl flex flex-col gap-5 stagger">

          {/* Hypothesis card */}
          <div className="card px-5 py-4">
            <p className="font-sans text-xs font-600 uppercase tracking-widest mb-1.5" style={{ color: 'var(--muted)' }}>
              Hypothesis
            </p>
            <p className="font-display text-xl font-semibold leading-snug" style={{ color: 'var(--ink)' }}>
              "{question}"
            </p>
          </div>

          {/* Novelty signal */}
          <div
            className="card px-5 py-5 flex flex-col gap-3"
            style={{ borderColor: cfg.border, background: cfg.bg }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: cfg.dot }}
              />
              <span className="font-sans font-bold text-sm" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
            <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--body)' }}>
              {cfg.description}
            </p>
          </div>

          {/* References */}
          {qcResult.references?.length > 0 && (
            <div className="card px-5 py-4 flex flex-col gap-3">
              <p className="font-sans text-xs font-600 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Retrieved References
              </p>
              <ul className="flex flex-col gap-2.5">
                {qcResult.references.map((url, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span
                      className="font-mono text-xs mt-0.5 flex-shrink-0 px-1.5 py-0.5 rounded"
                      style={{ color: 'var(--accent)', background: 'var(--accent-light)', border: '1px solid #bfdbfe' }}
                    >
                      {i + 1}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-sans text-sm break-all hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Context summary */}
          {qcResult.context_summary && (
            <div className="card px-5 py-4 flex flex-col gap-3">
              <p className="font-sans text-xs font-600 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
                Literature Snapshot
              </p>
              <div
                className="font-sans text-sm leading-relaxed max-h-40 overflow-y-auto pr-1"
                style={{ color: 'var(--body)', whiteSpace: 'pre-wrap' }}
              >
                {qcResult.context_summary}
              </div>
            </div>
          )}

          {error && (
            <p
              className="font-sans text-sm px-4 py-2 rounded"
              style={{ color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid #fca5a5' }}
            >
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            onClick={handleProceed}
            disabled={loading}
            className="btn-primary w-full py-3.5 rounded text-base"
          >
            {'Proceed to Plan Generation →'}
          </button>

          <p className="font-sans text-xs text-center" style={{ color: 'var(--muted)' }}>
            Plan generation uses GPT-4o with structured output and may take up to a minute.
          </p>
        </div>
      </main>
    </div>
  )
}
