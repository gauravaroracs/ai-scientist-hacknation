import { useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { pageTransition, fadeUp, staggerList, slideInLeft, fadeIn, spinnerRotate } from '../lib/animations'
import GuideTooltip from '../components/GuideTooltip'
import VoiceCall from '../components/VoiceCall'

// ── Markdown renderer ────────────────────────────────��────────────────────────
const MD_COMPONENTS = {
  p:          ({ children }) => <p style={{ margin: '0 0 8px', fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.65, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{children}</p>,
  strong:     ({ children }) => <strong style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{children}</strong>,
  em:         ({ children }) => <em style={{ fontStyle: 'italic' }}>{children}</em>,
  ul:         ({ children }) => <ul style={{ margin: '4px 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ul>,
  ol:         ({ children }) => <ol style={{ margin: '4px 0 8px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>{children}</ol>,
  li:         ({ children }) => <li style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.6, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{children}</li>,
  code:       ({ inline, children }) => inline
    ? <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,0,0,0.06)', border: '1px solid var(--border-soft)' }}>{children}</code>
    : <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: '10px 12px', borderRadius: 5, background: 'rgba(0,0,0,0.04)', border: '1px solid var(--border-soft)', overflowX: 'auto', margin: '4px 0 8px' }}><code>{children}</code></pre>,
  blockquote: ({ children }) => <blockquote style={{ margin: '4px 0 8px', paddingLeft: 10, borderLeft: '2px solid var(--border-soft)', color: 'var(--text-muted)' }}>{children}</blockquote>,
  a:          ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'underline', textUnderlineOffset: 2 }}>{children}</a>,
  h1:         ({ children }) => <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, letterSpacing: '-0.02em', margin: '8px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
  h2:         ({ children }) => <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 13, letterSpacing: '-0.02em', margin: '8px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
  h3:         ({ children }) => <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '-0.01em', margin: '6px 0 4px', color: 'var(--text-primary)' }}>{children}</h3>,
  hr:         () => <hr style={{ border: 'none', borderTop: '1px solid var(--border-soft)', margin: '8px 0' }} />,
}

function MarkdownMessage({ text }) {
  return (
    <div style={{ minWidth: 0 }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
        {text}
      </ReactMarkdown>
    </div>
  )
}

// ── Icons ──────────────────────────────────────────────────���───────────────────
function FlaskIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
    </svg>
  )
}

function CheckCircle2({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="9 12 11.5 14.5 15 10"/>
    </svg>
  )
}

function ArrowLeft({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function ArrowRight({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
function RotateCw({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}
function SendIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function BookOpen({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  )
}

// ── Novelty config ─────────────────────────────────────────────────────────────
const NOVELTY_CONFIG = {
  'not found': {
    label: 'Novel — No Prior Protocol Found',
    color: '#2D7A3A', bg: '#F0FFF4', border: 'rgba(45,122,58,0.2)',
    dotColor: '#2D7A3A',
    description: 'No existing protocols match this hypothesis. This appears to be unexplored territory — proceed with confidence.',
  },
  'similar work exists': {
    label: 'Similar Work Exists',
    color: '#D97706', bg: '#FFFBEB', border: 'rgba(217,119,6,0.2)',
    dotColor: '#D97706',
    description: 'Related or adjacent protocols have been published. Review the references before generating your plan.',
  },
  'exact match found': {
    label: 'Exact Match Found',
    color: '#C0392B', bg: '#FFF5F5', border: 'rgba(192,57,43,0.2)',
    dotColor: '#C0392B',
    description: 'An existing protocol closely matches this hypothesis. Consider refining your research question.',
  },
}

const LIT_SUGGESTIONS = [
  'What are the key findings across these papers?',
  'How novel is this hypothesis vs. existing work?',
  'What methodologies have been used?',
  'What gaps exist in the literature?',
]

// ── Plan-generating overlay ────────────────────────────────────────────────────
function PlanGeneratingOverlay({ stage, progress }) {
  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(242,237,227,0.94)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 32,
      }}
    >
      <motion.div animate={spinnerRotate.animate} style={{ color: 'var(--text-primary)' }}>
        <FlaskIcon size={40} />
      </motion.div>
      <div style={{ textAlign: 'center', maxWidth: 380 }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 20, letterSpacing: '-0.03em', color: 'var(--text-primary)', marginBottom: 8 }}>
          Generating Experiment Plan
        </h2>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', minHeight: 20 }}>
          {stage || 'Initialising…'}
        </p>
      </div>
      <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 3, background: 'var(--border-soft)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: 'var(--text-primary)',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
            Typically 30–60 seconds
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>
            {Math.round(progress)}%
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ── TaskItem (sidebar paper) ────────────────────────────────────────────────────
function TaskItem({ paper, index, isSelected, onClick }) {
  return (
    <motion.div
      variants={slideInLeft}
      onClick={onClick}
      className={`task-item ${isSelected ? 'active' : ''}`}
      style={{ cursor: 'pointer', padding: '5px 8px', gap: 7 }}
      whileHover={{ x: 1 }}
    >
      {/* Icon */}
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }}>
        <CheckCircle2 size={12} />
      </span>

      {/* Content — two lines max */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 500,
          color: 'var(--text-primary)', letterSpacing: '-0.01em',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {paper.title}
        </span>
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11,
          color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {[
            paper.year,
            paper.venue,
            paper.citation_count > 0 ? `+${paper.citation_count.toLocaleString()}` : null,
          ].filter(Boolean).join(' · ')}
        </span>
      </div>
    </motion.div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
function TaskSidebar({ papers, selectedIndex, onSelect }) {
  return (
    <div className="workspace-sidebar" style={{
      background: 'var(--bg-base)',
      borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 12px 8px',
        borderBottom: '1px solid var(--border-soft)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">Papers</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
            color: 'var(--text-muted)',
          }}>
            {papers.length}
          </span>
        </div>
      </div>

      {/* Paper list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px' }}>
        <AnimatePresence>
          <motion.div variants={staggerList} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {papers.length === 0 ? (
              <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', padding: '8px 6px' }}>
                No papers retrieved
              </p>
            ) : papers.map((paper, i) => (
              <TaskItem
                key={i}
                paper={paper}
                index={i}
                isSelected={selectedIndex === i}
                onClick={() => onSelect(i)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Main content (COL 2) ───────────────────────────────────────────────────────
function MessageThread({ question, qcResult, cfg, loading, error, onProceed, selectedPaper }) {
  const paper = selectedPaper

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        <motion.div
          variants={staggerList}
          initial="hidden"
          animate="visible"
          style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 620 }}
        >

          {/* User message — hypothesis */}
          <motion.div variants={fadeUp} className="user-message">
            <p className="section-label" style={{ marginBottom: 6 }}>Hypothesis</p>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 500, lineHeight: 1.55, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
              "{question}"
            </p>
          </motion.div>

          {/* Novelty signal — agent message */}
          <motion.div variants={fadeUp}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {/* Avatar */}
              <div style={{
                width: 24, height: 24, borderRadius: 4, flexShrink: 0, marginTop: 2,
                background: 'var(--bg-base)', border: '1px solid var(--border-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                <FlaskIcon size={12} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Literature QC
                </p>
                {/* Novelty card */}
                <GuideTooltip
                  title={cfg.label}
                  description={cfg.description}
                  placement="top"
                >
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 12px', borderRadius: 6,
                    background: cfg.bg, border: `1px solid ${cfg.border}`,
                    cursor: 'pointer', marginBottom: 10,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: cfg.dotColor, flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: cfg.color, letterSpacing: '-0.01em' }}>
                      {cfg.label}
                    </span>
                  </div>
                </GuideTooltip>
                <p className="agent-message" style={{ marginBottom: 8 }}>{cfg.description}</p>

                {/* References */}
                {qcResult.references?.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 16, minWidth: 0, overflow: 'hidden' }}>
                    <p className="section-label" style={{ marginBottom: 6 }}>Retrieved References</p>
                    {qcResult.references.map((url, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 6, background: 'var(--bg-base)', border: '1px solid var(--border-soft)', minWidth: 0 }}>
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
                          padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                          background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
                          color: 'var(--text-muted)',
                        }}>
                          {i + 1}
                        </span>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                          color: 'var(--text-secondary)',
                          textDecoration: 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          flex: 1, minWidth: 0,
                        }}
                          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.target.style.textDecoration = 'none'}
                        >
                          {url}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Selected paper detail */}
          <AnimatePresence mode="wait">
            {paper && (
              <motion.div
                key={paper.title}
                variants={fadeUp}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 4, flexShrink: 0, marginTop: 2,
                    background: 'var(--bg-base)', border: '1px solid var(--border-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--text-muted)',
                  }}>
                    <BookOpen size={11} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      Selected Paper
                    </p>
                    <div className="file-diff-card" style={{ display: 'block', cursor: 'default' }}>
                      {paper.url ? (
                        <a href={paper.url} target="_blank" rel="noopener noreferrer" style={{
                          fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600,
                          color: 'var(--text-primary)', letterSpacing: '-0.01em',
                          textDecoration: 'none', display: 'block', marginBottom: 6,
                        }}
                          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.target.style.textDecoration = 'none'}
                        >
                          {paper.title}
                        </a>
                      ) : (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em', marginBottom: 6 }}>
                          {paper.title}
                        </p>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: paper.abstract ? 10 : 0 }}>
                        {paper.year && (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 3, background: 'var(--bg-base)', border: '1px solid var(--border-soft)' }}>
                            {paper.year}
                          </span>
                        )}
                        {paper.venue && (
                          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', padding: '1px 6px', borderRadius: 3, background: 'var(--bg-base)', border: '1px solid var(--border-soft)' }}>
                            {paper.venue}
                          </span>
                        )}
                        {paper.citation_count > 0 && (
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: 'var(--diff-add)', padding: '1px 6px', borderRadius: 3, background: 'rgba(45,122,58,0.06)', border: '1px solid rgba(45,122,58,0.15)' }}>
                            +{paper.citation_count.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {paper.abstract && (
                        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'var(--text-muted)' }}>
                          {paper.abstract}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.p variants={fadeUp} style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '10px 14px', borderRadius: 6,
              color: 'var(--danger)', background: 'var(--danger-light)', border: '1px solid rgba(192,57,43,0.2)',
            }}>
              {error}
            </motion.p>
          )}

        </motion.div>
      </div>

      {/* Proceed bar */}
      <div style={{
        padding: '12px 28px',
        borderTop: '1px solid var(--border-soft)',
        background: 'var(--bg-surface)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
          Plan generation uses AI and may take up to a minute.
        </p>
        <motion.button
          onClick={onProceed}
          disabled={loading}
          className="btn-primary"
          style={{ padding: '7px 18px', fontSize: 13 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? 'Generating…' : 'Proceed to Plan →'}
        </motion.button>
      </div>
    </div>
  )
}

// ── Literature Chat (COL 3) ────────────────────────────────────────────────────
function PreviewPane({ question, papers, references, novelty_signal }) {
  const litContext = {
    question, novelty_signal,
    references: references || [],
    papers: (papers || []).map(p => ({ title: p.title, year: p.year, venue: p.venue, citation_count: p.citation_count, abstract: p.abstract })),
  }

  const [inputValue, setInputValue] = useState('')
  const transportRef = useRef(new TextStreamChatTransport({ api: '/api/chat' }))
  const { messages, sendMessage, status } = useChat({ transport: transportRef.current })
  const isLoading = status === 'streaming' || status === 'submitted'
  const [url, setUrl] = useState('labagent://literature-qa')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = (text) => {
    const msg = text ?? inputValue
    if (!msg?.trim() || isLoading) return
    sendMessage({ text: msg.trim() }, { body: { context: litContext } })
    setInputValue('')
  }

  return (
    <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Browser chrome */}
      <div style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0 }}>
        {/* Tab strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '6px 12px 0', borderBottom: '1px solid var(--border-soft)' }}>
          <div style={{
            fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 500,
            color: 'var(--text-primary)',
            padding: '5px 14px 5px',
            borderRadius: '5px 5px 0 0',
            background: '#ffffff',
            border: '1px solid var(--border-soft)',
            borderBottom: '1px solid #ffffff',
            marginBottom: -1,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <BookOpen size={11} />
            Literature Q&amp;A
            {isLoading && (
              <motion.span animate={spinnerRotate.animate} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
              </motion.span>
            )}
          </div>
        </div>
        {/* Address bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 3, borderRadius: 3 }} title="Back">
            <ArrowLeft />
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 3, borderRadius: 3 }} title="Forward">
            <ArrowRight />
          </button>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 3, borderRadius: 3 }} title="Reload">
            <RotateCw />
          </button>
          <input
            className="preview-address-bar"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
        </div>
      </div>

      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 4px' }}>
              Ask questions about the retrieved papers
            </p>
            {LIT_SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                onClick={() => submit(s)}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  fontFamily: 'Inter, sans-serif', fontSize: 12, textAlign: 'left',
                  padding: '8px 12px', borderRadius: 6,
                  background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
                  color: 'var(--text-secondary)', cursor: 'pointer',
                  transition: 'background 0.15s',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              >
                {s}
              </motion.button>
            ))}
          </div>
        ) : (
          <AnimatePresence>
            {messages.map(m => {
              const text = m.parts ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('') : (m.content ?? '')
              const isUser = m.role === 'user'
              return (
                <motion.div key={m.id} variants={fadeUp} initial="hidden" animate="visible"
                  style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '88%', padding: '8px 12px', borderRadius: 6,
                    background: isUser ? 'var(--text-primary)' : 'var(--bg-base)',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    border: isUser ? 'none' : '1px solid var(--border-soft)',
                    fontSize: 13, lineHeight: 1.6, letterSpacing: '-0.01em',
                  }}>
                    {isUser ? (
                      <span style={{ fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap' }}>{text}</span>
                    ) : (
                      <MarkdownMessage text={text} />
                    )}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border-soft)',
          display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          background: '#ffffff',
        }}
      >
        <input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
          placeholder="Ask about these papers…"
          disabled={isLoading}
          style={{
            flex: 1, padding: '7px 12px', borderRadius: 6,
            border: '1px solid var(--border-soft)',
            background: 'var(--bg-base)',
            color: 'var(--text-primary)', outline: 'none',
            fontFamily: 'Inter, sans-serif', fontSize: 13,
            letterSpacing: '-0.01em',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.2)'}
          onBlur={e => e.target.style.borderColor = 'var(--border-soft)'}
        />
        <GuideTooltip title="Send" description="Send your question to the literature assistant" shortcut="↵">
          <motion.button
            type="submit"
            disabled={isLoading || !inputValue?.trim()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: isLoading || !inputValue?.trim() ? 'var(--bg-base)' : 'var(--text-primary)',
              border: '1px solid var(--border-soft)',
              cursor: isLoading || !inputValue?.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
          >
            <SendIcon size={12} />
          </motion.button>
        </GuideTooltip>
      </form>
    </div>
  )
}

// ── Top nav ────────────────────────────────────────────────────────────────────
function TopNav() {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-soft)',
      background: 'var(--bg-surface)',
      flexShrink: 0, zIndex: 40,
    }}>
      <div style={{ height: 40, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--text-primary)' }}>
          <FlaskIcon size={13} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em' }}>
            LabProcure
          </span>
        </Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Literature QC</span>
      </div>
    </header>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function QCPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { qcResult, question } = location.state || {}

  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')
  const [stage, setStage]             = useState('')
  const [progress, setProgress]       = useState(0)
  const [selectedPaperIdx, setSelectedPaperIdx] = useState(null)

  if (!qcResult || !question) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: 320 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>No QC data found.</p>
          <Link to="/" className="btn-primary" style={{ padding: '7px 18px', fontSize: 13, textDecoration: 'none' }}>← Start over</Link>
        </div>
      </div>
    )
  }

  const cfg = NOVELTY_CONFIG[qcResult.novelty_signal] || NOVELTY_CONFIG['similar work exists']
  const papers = qcResult.papers || []

  const handleProceed = async () => {
    setLoading(true); setError(''); setStage(''); setProgress(0)
    try {
      const res = await fetch('/generate-plan/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, literature_context: qcResult.context_summary || '', references: qcResult.references || [] }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const reader = res.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.stage === 'error') throw new Error(data.message)
          if (data.stage === 'done') { navigate('/plan', { state: { plan: data.plan, question, correctionsApplied: data.corrections_applied ?? 0 } }); return }
          flushSync(() => { setStage(data.stage); setProgress(data.pct) })
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate plan.')
      setLoading(false)
    }
  }

  const selectedPaper = selectedPaperIdx !== null ? papers[selectedPaperIdx] : null

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}
    >
      <AnimatePresence>
        {loading && <PlanGeneratingOverlay stage={stage} progress={progress} />}
      </AnimatePresence>

      <TopNav />

      {/* 3-column workspace */}
      <div className="workspace-grid" style={{ flex: 1, minHeight: 0 }}>
        {/* COL 1 — Sidebar */}
        <TaskSidebar
          papers={papers}
          selectedIndex={selectedPaperIdx}
          onSelect={(i) => setSelectedPaperIdx(prev => prev === i ? null : i)}
        />

        {/* COL 2 — Message thread */}
        <MessageThread
          question={question}
          qcResult={qcResult}
          cfg={cfg}
          loading={loading}
          error={error}
          onProceed={handleProceed}
          selectedPaper={selectedPaper}
        />

        {/* COL 3 — Preview / LitChat */}
        <PreviewPane
          question={question}
          papers={papers}
          references={qcResult.references}
          novelty_signal={qcResult.novelty_signal}
        />
      </div>

      {/* Floating voice call button */}
      <VoiceCall
        context={{
          question,
          novelty_signal: qcResult.novelty_signal,
          references: qcResult.references || [],
          papers: papers.map(p => ({
            title: p.title, year: p.year, venue: p.venue,
            citation_count: p.citation_count, abstract: p.abstract,
          })),
        }}
      />

      {/* Mobile-only sticky footer with Generate button */}
      <div className="mobile-proceed-bar" style={{
        display: 'none',
        padding: '10px 16px',
        borderTop: '1px solid var(--border-soft)',
        background: 'var(--bg-surface)',
        flexShrink: 0,
      }}>
        <motion.button
          onClick={handleProceed}
          disabled={loading}
          className="btn-primary"
          style={{ width: '100%', padding: '10px 18px', fontSize: 14 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
        >
          {loading ? 'Generating…' : 'Proceed to Plan →'}
        </motion.button>
      </div>
    </motion.div>
  )
}
