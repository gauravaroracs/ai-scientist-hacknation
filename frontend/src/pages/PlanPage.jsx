import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { pageTransition, staggerList, slideInLeft, fadeUp, fadeIn, spinnerRotate } from '../lib/animations'
import InlineEdit from '../components/InlineEdit'
import Toast from '../components/Toast'
import ProductComparison from '../components/ProductComparison'
import GuideTooltip from '../components/GuideTooltip'
import VoiceCall from '../components/VoiceCall'

// ── Markdown renderer ─────────────────────────────────────────────────────────
const MD_COMPONENTS = {
  p:          ({ children }) => <p style={{ margin: '0 0 8px', fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.65, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>{children}</p>,
  strong:     ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
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

// ── Persistent session state ───────────────────────────────────────────────────
function usePlanStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    if (!key) return initialValue
    try { const s = sessionStorage.getItem(key); return s ? JSON.parse(s) : initialValue } catch { return initialValue }
  })
  useEffect(() => {
    if (!key) return
    try { sessionStorage.setItem(key, JSON.stringify(value)) } catch {}
  }, [key, value])
  return [value, setValue]
}

// ── Icons ──────────────────────────────────────────────────────────────────────
function FlaskIcon({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
    </svg>
  )
}
function CheckCircle2({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="9 12 11.5 14.5 15 10"/>
    </svg>
  )
}
function Spinner({ size = 13 }) {
  return (
    <motion.span animate={spinnerRotate.animate} style={{ display: 'inline-flex' }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
    </motion.span>
  )
}
function FileCode2({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <polyline points="10 13 8 15 10 17"/>
      <polyline points="14 13 16 15 14 17"/>
    </svg>
  )
}
function SendIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}
function ArrowLeft({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  )
}
function ArrowRight({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  )
}
function RotateCw({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  )
}

const CHART_COLORS = ['#111110', '#4A4A44', '#9A9A94', '#2D7A3A', '#D97706', '#C0392B', '#0F766E']

// ── Budget helpers ─────────────────────────────────────────────────────────────
function recalculateBudget(updatedMaterials, currentBudget) {
  const materialNames = new Set(updatedMaterials.map(m => m.name))
  const materialLines = updatedMaterials.filter(m => parseFloat(m.unit_price) > 0).map(m => ({ item: m.name, cost: Math.round(parseFloat(m.unit_price) * 100) / 100 }))
  const materialsTotal = materialLines.reduce((s, l) => s + l.cost, 0)
  const overheadLines  = currentBudget.filter(l => !materialNames.has(l.item))
  const newOverhead    = Math.round(materialsTotal * 0.22 * 100) / 100
  const origOverhead   = overheadLines.reduce((s, l) => s + l.cost, 0)
  const scaled = overheadLines.map(l => ({ ...l, cost: Math.round((origOverhead > 0 ? (l.cost / origOverhead) * newOverhead : newOverhead / Math.max(overheadLines.length, 1)) * 100) / 100 }))
  return [...materialLines, ...scaled]
}

function parseMaterialText(text) {
  const parts = text.split(' | '); const out = { name: parts[0]?.trim() || '' }
  parts.slice(1).forEach(part => {
    if (part.startsWith('SKU: '))       out.catalog_number = part.slice(5).trim()
    else if (part.startsWith('Supplier: ')) out.supplier    = part.slice(10).trim()
    else if (part.startsWith('Price: $'))  out.unit_price   = parseFloat(part.slice(8)) || 0
    else if (part.startsWith('Qty: '))     out.quantity     = part.slice(5).trim()
  })
  return out
}

const SUPPLIER_EMAIL = 'xiniu2224@gmail.com'

// ── Shared stat row ────────────────────────────────────────────────────────────
function StatPill({ label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
        {label}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
        {value}
      </span>
    </div>
  )
}

// ── COL 1: Protocol Sidebar ────────────────────────────────────────────────────
function ProtocolSidebar({ steps, activeStep, onSelectStep, correctionCount }) {
  const stepsArr = (steps || []).map(s => typeof s === 'string' ? s : s.step)

  return (
    <div className="workspace-sidebar" style={{
      background: 'var(--bg-base)', borderRight: '1px solid var(--border-soft)',
      display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 10px 8px', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="section-label">Protocol</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600,
            padding: '1px 6px', borderRadius: 3,
            background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)',
          }}>
            {stepsArr.length}
          </span>
        </div>
        {correctionCount > 0 && (
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600,
              color: 'var(--diff-add)', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--diff-add)', display: 'inline-block' }} />
              {correctionCount} edit{correctionCount !== 1 ? 's' : ''} saved
            </span>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        <AnimatePresence>
          <motion.div variants={staggerList} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {stepsArr.map((step, i) => {
              const isDone = i < activeStep
              const isActive = i === activeStep
              return (
                <motion.div
                  key={i}
                  variants={slideInLeft}
                  onClick={() => onSelectStep(i)}
                  className={`task-item ${isActive ? 'active' : ''}`}
                  style={{ padding: '5px 8px', gap: 7 }}
                >
                  {/* Status icon */}
                  <span style={{ color: isDone ? 'var(--diff-add)' : isActive ? 'var(--text-primary)' : 'var(--text-muted)', flexShrink: 0, marginTop: 1 }}>
                    {isDone ? <CheckCircle2 size={12} /> : isActive ? <Spinner size={12} /> : (
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', width: 13, height: 13 }}>
                        {String(i + 1).padStart(2, '0')}
                      </span>
                    )}
                  </span>

                  {/* Step text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: isActive ? 600 : 400,
                      color: isDone ? 'var(--text-muted)' : 'var(--text-primary)',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      letterSpacing: '-0.01em',
                    }}>
                      {step}
                    </span>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
                      Step {i + 1}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── COL 2: Tab content ─────────────────────────────────────────────────────────
const TABS = ['Protocol', 'Budget', 'Materials', 'Timeline', 'Validation']

// Budget
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  const pct = ((d.value / d.payload.total) * 100).toFixed(1)
  return (
    <div className="card" style={{ padding: '10px 12px', minWidth: 160 }}>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{d.payload.item}</p>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>${Number(d.value).toFixed(2)}</p>
      <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{pct}% of total</p>
    </div>
  )
}

function BudgetTab({ budget, totalBudget, question, onCorrection, onBudgetChange }) {
  const local = budget; const setLocal = onBudgetChange
  const [highlighted, setHighlighted] = useState(null)
  const chartData = local.map(r => ({ ...r, total: totalBudget }))
  const largest = [...local].sort((a, b) => b.cost - a.cost)[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        {[
          { label: 'Total Budget', value: `$${Number(totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}` },
          { label: 'Line Items',   value: local.length },
          { label: 'Largest Cost', value: largest ? `$${Number(largest.cost).toFixed(2)}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ padding: '12px 14px' }}>
            <p className="section-label" style={{ marginBottom: 4 }}>{label}</p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Chart + legend */}
      <div className="card" style={{ padding: '14px 16px' }}>
        <p className="section-label" style={{ marginBottom: 12 }}>Cost Breakdown</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 160, height: 160, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} cx="50%" cy="50%" innerRadius={46} outerRadius={72} paddingAngle={2} dataKey="cost"
                  onMouseEnter={(_, i) => setHighlighted(i)} onMouseLeave={() => setHighlighted(null)}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="var(--bg-surface)" strokeWidth={1.5}
                      opacity={highlighted === null || highlighted === i ? 1 : 0.25}
                      style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, minWidth: 120, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {local.map((row, i) => {
              const pct = ((row.cost / totalBudget) * 100).toFixed(1)
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: highlighted === null || highlighted === i ? 1 : 0.3, transition: 'opacity 0.15s' }}
                  onMouseEnter={() => setHighlighted(i)} onMouseLeave={() => setHighlighted(null)}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{row.item}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="section-label">Line Items</p>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>Hover to suggest a correction</p>
        </div>
        {local.map((row, i) => {
          const pct = (row.cost / totalBudget) * 100
          return (
            <InlineEdit key={i} originalText={`${row.item} — $${Number(row.cost).toFixed(2)}`} question={question} category="budget" itemLabel={row.item}
              onSaved={(corrected) => { const updated = [...local]; const parts = corrected.split('—'); updated[i] = { ...updated[i], item: parts[0]?.trim() || row.item }; setLocal(updated); onCorrection() }}>
              <div style={{ padding: '10px 14px', borderBottom: i < local.length - 1 ? '1px solid var(--border-soft)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{row.item}</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>${Number(row.cost).toFixed(2)}</span>
                </div>
                <div style={{ height: 2, background: 'var(--border-soft)', borderRadius: 1, overflow: 'hidden', marginLeft: 14 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length], transition: 'width 0.4s ease' }} />
                </div>
              </div>
            </InlineEdit>
          )
        })}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-base)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Total</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>${Number(totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      </div>
    </div>
  )
}

// Materials
function MaterialsTab({ materials, question, onCorrection, onEmailResult, onMaterialsChange }) {
  const local = materials; const setLocal = onMaterialsChange
  const [emailSending, setEmailSending] = useState(false)
  const [compareTarget, setCompareTarget] = useState(null)

  const handleEmailQuote = async () => {
    setEmailSending(true)
    try {
      const res = await fetch('/email-quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ supplier: local[0]?.supplier ?? 'Supplier', materials: local, experiment_question: question }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Unknown error')
      onEmailResult(true, 'Email sent successfully')
    } catch (err) { onEmailResult(false, `Email failed: ${err.message}`) }
    finally { setEmailSending(false) }
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p className="section-label">{local.length} item{local.length !== 1 ? 's' : ''}</p>
          <motion.button onClick={handleEmailQuote} disabled={emailSending} className="btn-primary"
            style={{ padding: '5px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, opacity: emailSending ? 0.5 : 1 }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
            <SendIcon size={11} />
            {emailSending ? 'Sending…' : 'Email Quote'}
          </motion.button>
        </div>
        {local.map((m, i) => (
          <InlineEdit key={i} originalText={`${m.name} | SKU: ${m.catalog_number} | Supplier: ${m.supplier} | Price: $${m.unit_price} | Qty: ${m.quantity}`}
            question={question} category="material" itemLabel={m.name}
            onSaved={(corrected) => { const parsed = parseMaterialText(corrected); const updated = local.map((item, idx) => idx === i ? { ...item, ...parsed } : item); setLocal(updated); onCorrection() }}>
            <GuideTooltip title={m.name} description={`${m.supplier} · SKU ${m.catalog_number}`} shortcut="Click to edit">
              <motion.div className="card card-hover" style={{ padding: '12px 14px', cursor: 'default' }} whileHover={{ y: -2 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{m.name}</span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border-soft)', background: 'var(--bg-base)', color: 'var(--text-muted)', flexShrink: 0 }}>{m.supplier}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>SKU</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{m.catalog_number}</span>
                  </span>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{m.quantity}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'auto' }}>${Number(m.unit_price).toFixed(2)}</span>
                  <button onClick={(e) => { e.stopPropagation(); setCompareTarget(m) }}
                    style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 5, border: '1px solid var(--border-soft)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    Compare
                  </button>
                </div>
              </motion.div>
            </GuideTooltip>
          </InlineEdit>
        ))}
      </div>
      {compareTarget && <ProductComparison material={compareTarget} onClose={() => setCompareTarget(null)} />}
    </>
  )
}

// Timeline
function TimelineTab({ timeline, question, onCorrection, storageKey }) {
  const [activePhase, setActivePhase] = useState(0)
  const [localTimeline, setLocalTimeline] = usePlanStorage(storageKey, timeline)
  const updateTask = (pi, ti, text) => setLocalTimeline(prev => prev.map((p, i) => i !== pi ? p : { ...p, tasks: p.tasks.map((t, j) => j === ti ? text : t) }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 2 }}>
        {localTimeline.map((phase, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button onClick={() => setActivePhase(i)} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 6px',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700,
                background: activePhase === i ? 'var(--text-primary)' : 'var(--bg-hover)',
                color: activePhase === i ? '#fff' : 'var(--text-muted)',
                border: `1px solid ${activePhase === i ? 'var(--text-primary)' : 'var(--border-soft)'}`,
                transition: 'all 0.15s',
              }}>
                {i + 1}
              </div>
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 500, color: activePhase === i ? 'var(--text-primary)' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {phase.phase}
              </span>
            </button>
            {i < localTimeline.length - 1 && (
              <div style={{ width: 24, height: 1.5, background: i < activePhase ? 'var(--text-primary)' : 'var(--border-soft)', marginBottom: 16, transition: 'background 0.3s' }} />
            )}
          </div>
        ))}
      </div>

      {localTimeline[activePhase] && (
        <motion.div key={activePhase} variants={fadeIn} initial="hidden" animate="visible" className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{localTimeline[activePhase].phase}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>{localTimeline[activePhase].tasks.length} tasks</span>
          </div>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {localTimeline[activePhase].tasks.map((task, j) => (
              <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ flexShrink: 0, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {j + 1}
                </span>
                <InlineEdit originalText={task} question={question} category="timeline" itemLabel={`${localTimeline[activePhase].phase} — Task ${j + 1}`} onSaved={(c) => { updateTask(activePhase, j, c); onCorrection() }}>
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>{task}</span>
                </InlineEdit>
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 6, paddingTop: 12, marginTop: 4, borderTop: '1px solid var(--border-soft)' }}>
            {activePhase > 0 && <button onClick={() => setActivePhase(p => p - 1)} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>← Prev</button>}
            {activePhase < localTimeline.length - 1 && <button onClick={() => setActivePhase(p => p + 1)} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}>Next →</button>}
          </div>
        </motion.div>
      )}
    </div>
  )
}

// Validation
function InfoRow({ label, value, color, bg, border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}>
      <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 11, padding: '2px 8px', borderRadius: 4, background: bg || 'var(--bg-base)', border: `1px solid ${border || 'var(--border-soft)'}`, color: color || 'var(--text-secondary)', flexShrink: 0, marginTop: 1, minWidth: 52, textAlign: 'center' }}>
        {label}
      </span>
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', letterSpacing: '-0.01em' }}>{value}</span>
    </div>
  )
}

function ValidationTab({ validation, question, onCorrection, storageKey }) {
  const [local, setLocal] = usePlanStorage(storageKey, validation)
  const updateField = (i, field, val) => setLocal(prev => prev.map((v, vi) => vi === i ? { ...v, [field]: val } : v))
  if (!local?.length) return <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>No validation criteria returned.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {local.map((v, i) => (
        <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, width: 22, height: 22, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{v.metric}</span>
          </div>
          <div style={{ paddingLeft: 32, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <InfoRow label="Method" value={v.method} />
            <InlineEdit originalText={v.success_threshold} question={question} category="validation" itemLabel={`${v.metric} — success threshold`} onSaved={(c) => { updateField(i, 'success_threshold', c); onCorrection() }}>
              <InfoRow label="Pass" value={v.success_threshold} color="var(--diff-add)" bg="rgba(45,122,58,0.06)" border="rgba(45,122,58,0.2)" />
            </InlineEdit>
            <InlineEdit originalText={v.failure_indicator} question={question} category="validation" itemLabel={`${v.metric} — failure indicator`} onSaved={(c) => { updateField(i, 'failure_indicator', c); onCorrection() }}>
              <InfoRow label="Fail" value={v.failure_indicator} color="var(--diff-remove)" bg="rgba(192,57,43,0.06)" border="rgba(192,57,43,0.2)" />
            </InlineEdit>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Protocol step expander (COL 2 when step selected) ─────────────────────────
function ProtocolStep({ step, index, question, onCorrection, storageKey, total, onPrev, onNext }) {
  const stepText = typeof step === 'string' ? step : step.step
  const citations = typeof step === 'string' ? [] : (step.citations || [])
  const [local, setLocal] = usePlanStorage(storageKey ? `${storageKey}_step_${index}` : null, stepText)

  return (
    <motion.div key={index} variants={fadeIn} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Step header */}
      <div className="user-message">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-base)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)' }}>
            STEP {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
        <InlineEdit originalText={stepText} question={question} category="protocol" itemLabel={`Step ${index + 1}`}
          onSaved={(corrected) => { setLocal(corrected); onCorrection() }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, lineHeight: 1.65, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {local}
          </p>
        </InlineEdit>
      </div>

      {citations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p className="section-label">References</p>
          {citations.map((url, ci) => (
            <div key={ci} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'var(--bg-base)', border: '1px solid var(--border-soft)', color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }}>{ci + 1}</span>
              <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-secondary)', wordBreak: 'break-all', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                onMouseLeave={e => e.target.style.textDecoration = 'none'}>{url}</a>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {index > 0 && <button onClick={onPrev} className="btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }}>← Prev</button>}
        {index < total - 1 && <button onClick={onNext} className="btn-primary" style={{ padding: '5px 12px', fontSize: 12 }}>Next →</button>}
        {index === total - 1 && (
          <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '5px 12px', borderRadius: 5, background: 'rgba(45,122,58,0.08)', border: '1px solid rgba(45,122,58,0.2)', color: 'var(--diff-add)' }}>
            ✓ Protocol complete
          </span>
        )}
      </div>
    </motion.div>
  )
}

// ── COL 2: Protocol tab (inline step list) ─────────────────────────────────────
function ProtocolTabContent({ steps, onStepChange }) {
  const stepsArr = (steps || []).map(s => typeof s === 'string' ? s : s.step)
  if (!stepsArr.length) return <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)' }}>No protocol steps yet.</p>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {stepsArr.map((step, i) => (
        <button
          key={i}
          onClick={() => onStepChange(i)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: 12,
            padding: '10px 14px', borderRadius: 6,
            background: 'var(--bg-base)', border: '1px solid var(--border-soft)',
            cursor: 'pointer', textAlign: 'left', width: '100%',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-base)'}
        >
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700,
            width: 22, height: 22, borderRadius: 4, flexShrink: 0, marginTop: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-surface)', border: '1px solid var(--border-soft)',
            color: 'var(--text-muted)',
          }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)', letterSpacing: '-0.01em', margin: 0 }}>
            {step}
          </p>
        </button>
      ))}
    </div>
  )
}

// ── COL 2: Main Content ────────────────────────────────────────────────────────
function MainContent({ plan, question, activeStep, onStepChange, activeTab, onTabChange, materials, budget, totalBudget, onCorrection, onMaterialsChange, onBudgetChange, onEmailResult, sk, correctionsApplied }) {

  return (
    <div style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-soft)', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Back bar — visible when viewing a step */}
      {activeStep !== null && (
        <div style={{
          padding: '6px 14px',
          borderBottom: '1px solid var(--border-soft)',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <button
            onClick={() => { onStepChange(null); onTabChange('Budget') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-secondary)',
              padding: '2px 0',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          >
            <ArrowLeft size={12} />
            Back to Overview
          </button>
        </div>
      )}

      {/* Step view */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <AnimatePresence mode="wait">
          {activeStep !== null ? (
            <ProtocolStep
              key={`step-${activeStep}`}
              step={(plan.protocol || [])[activeStep]}
              index={activeStep}
              question={question}
              onCorrection={onCorrection}
              storageKey={sk('protocol')}
              total={(plan.protocol || []).length}
              onPrev={() => onStepChange(activeStep - 1)}
              onNext={() => onStepChange(activeStep + 1)}
            />
          ) : (
            <motion.div key="tabs" variants={fadeIn} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Stats header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-soft)', flexWrap: 'wrap' }}>
                <StatPill label="Budget" value={`$${Number(totalBudget).toLocaleString('en-US', { minimumFractionDigits: 0 })}`} />
                <StatPill label="Timeline" value={plan.timeline?.length > 0 ? `${plan.timeline[0].phase} – ${plan.timeline[plan.timeline.length - 1].phase}` : '—'} />
                <StatPill label="Steps" value={plan.protocol?.length ?? 0} />
                <StatPill label="Materials" value={plan.materials?.length ?? 0} />
                {correctionsApplied > 0 && (
                  <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, fontWeight: 600, color: 'var(--diff-add)', padding: '2px 8px', borderRadius: 4, background: 'rgba(45,122,58,0.08)', border: '1px solid rgba(45,122,58,0.2)', marginLeft: 'auto' }}>
                    ✦ {correctionsApplied} expert correction{correctionsApplied !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Tabs — horizontally scrollable on mobile */}
              <div style={{ overflowX: 'auto', paddingBottom: 2, flexShrink: 0 }}>
                <div className="tabs-pill-container" style={{ minWidth: 'max-content' }}>
                  {TABS.map(tab => (
                    <button key={tab} onClick={() => onTabChange(tab)} className={`tab-pill${activeTab === tab ? ' active' : ''}`}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} variants={fadeIn} initial="hidden" animate="visible">
                  {activeTab === 'Protocol'   && <ProtocolTabContent steps={plan.protocol || []} onStepChange={(i) => { onStepChange(i) }} />}
                  {activeTab === 'Budget'     && <BudgetTab     budget={budget} totalBudget={totalBudget} question={question} onCorrection={onCorrection} onBudgetChange={onBudgetChange} />}
                  {activeTab === 'Materials'  && <MaterialsTab  materials={materials} question={question} onCorrection={onCorrection} onEmailResult={onEmailResult} onMaterialsChange={onMaterialsChange} />}
                  {activeTab === 'Timeline'   && <TimelineTab   timeline={plan.timeline || []} question={question} onCorrection={onCorrection} storageKey={sk('timeline')} />}
                  {activeTab === 'Validation' && <ValidationTab validation={plan.validation || []} question={question} onCorrection={onCorrection} storageKey={sk('validation')} />}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hint bar */}
      {activeStep === null && (
        <div style={{ padding: '8px 24px', borderTop: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, color: 'var(--text-muted)' }}>
            Select a step from the sidebar to view its details. Hover any field to suggest a correction.
          </p>
        </div>
      )}
    </div>
  )
}

// ── COL 3: Plan Assistant ──────────────────────────────────────────────────────
const PLAN_SUGGESTIONS = [
  'Why was this protocol chosen?',
  'What are the main failure risks?',
  'Can I substitute any reagents?',
  'How long does each step take?',
]

function PlanAssistant({ question, plan, onCorrection, sk }) {

  // Chat state
  const [inputValue, setInputValue] = useState('')
  const transportRef = useRef(new TextStreamChatTransport({ api: '/api/chat' }))
  const { messages, sendMessage, status } = useChat({ transport: transportRef.current })
  const isLoading = status === 'streaming' || status === 'submitted'
  const planContext = { question, protocol: plan?.protocol || [], materials: plan?.materials || [], total_budget: plan?.total_budget || 0, timeline: plan?.timeline || [] }
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = (text) => {
    const msg = text ?? inputValue
    if (!msg?.trim() || isLoading) return
    sendMessage({ text: msg.trim() }, { body: { context: planContext } })
    setInputValue('')
  }

  return (
    <div style={{ background: '#ffffff', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0, padding: '0 14px', height: 36, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          Plan Assistant
        </span>
        {isLoading && (
          <motion.span animate={spinnerRotate.animate} style={{ display: 'inline-flex', color: 'var(--text-muted)' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
          </motion.span>
        )}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 4px' }}>
                    Ask about the protocol, reagents, risks, or methodology
                  </p>
                  {PLAN_SUGGESTIONS.map((s, i) => (
                    <motion.button key={i} onClick={() => submit(s)} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, textAlign: 'left', padding: '8px 12px', borderRadius: 6, background: 'var(--bg-surface)', border: '1px solid var(--border-soft)', color: 'var(--text-secondary)', cursor: 'pointer', letterSpacing: '-0.01em', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                    >{s}</motion.button>
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
                        <div style={{ maxWidth: '88%', padding: '8px 12px', borderRadius: 6, background: isUser ? 'var(--text-primary)' : 'var(--bg-base)', color: isUser ? '#fff' : 'var(--text-primary)', border: isUser ? 'none' : '1px solid var(--border-soft)', fontSize: 13, lineHeight: 1.6, letterSpacing: '-0.01em' }}>
                          {isUser ? <span style={{ fontFamily: 'Inter, sans-serif', whiteSpace: 'pre-wrap' }}>{text}</span> : <MarkdownMessage text={text} />}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <form onSubmit={e => { e.preventDefault(); submit() }} style={{ padding: '10px 12px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, background: '#ffffff' }}>
              <input value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
                placeholder="Ask about this experiment…" disabled={isLoading}
                style={{ flex: 1, padding: '7px 12px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-base)', color: 'var(--text-primary)', outline: 'none', fontFamily: 'Inter, sans-serif', fontSize: 13, letterSpacing: '-0.01em', transition: 'border-color 0.15s' }}
                onFocus={e => e.target.style.borderColor = 'rgba(0,0,0,0.2)'}
                onBlur={e => e.target.style.borderColor = 'var(--border-soft)'}
              />
              <motion.button type="submit" disabled={isLoading || !inputValue?.trim()} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                style={{ width: 32, height: 32, borderRadius: 6, flexShrink: 0, background: isLoading || !inputValue?.trim() ? 'var(--bg-base)' : 'var(--text-primary)', border: '1px solid var(--border-soft)', cursor: isLoading || !inputValue?.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
                <SendIcon size={11} />
              </motion.button>
            </form>
      </div>
    </div>
  )
}

// ── Top nav ────────────────────────────────────────────────────────────────────
function TopNav({ question }) {
  return (
    <header style={{ borderBottom: '1px solid var(--border-soft)', background: 'var(--bg-surface)', flexShrink: 0, zIndex: 40 }}>
      <div style={{ height: 40, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', color: 'var(--text-primary)', flexShrink: 0 }}>
          <FlaskIcon size={13} />
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em' }}>LabProcure</span>
        </Link>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: 'var(--text-muted)', flexShrink: 0 }}>Literature QC</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" style={{ flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>Experiment Plan</span>
        {question && (
          <>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0, marginLeft: 4 }}>
              <div style={{ width: 1, height: 16, background: 'var(--border-soft)', marginRight: 10, flexShrink: 0 }} />
              <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                "{question}"
              </span>
            </div>
          </>
        )}
      </div>
    </header>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function PlanPage() {
  const location = useLocation()
  const { plan, question, correctionsApplied = 0 } = location.state || {}
  const [activeStep, setActiveStep]             = useState(null)
  const [activeTab,  setActiveTab]              = useState('Budget')
  const [correctionCount, setCorrectionCount]   = useState(0)
  const [toast, setToast]                       = useState(null)

  if (!plan) return <Navigate to="/" replace />

  const sk = (section) => question ? `plan__${question.slice(0, 40)}__${section}` : null

  const [materials, setMaterials] = usePlanStorage(sk('materials'), plan.materials || [])
  const [budget,    setBudget]    = usePlanStorage(sk('budget'),    plan.budget    || [])
  const totalBudget = Math.round(budget.reduce((s, l) => s + l.cost, 0) * 100) / 100

  const handleMaterialsChange = (updatedMaterials) => {
    setMaterials(updatedMaterials)
    setBudget(recalculateBudget(updatedMaterials, budget))
  }

  const handleCorrection = (_text, success = true) => {
    setCorrectionCount(c => c + 1)
    setToast(success ? { message: 'Correction saved — will improve future plans.', type: 'success' } : { message: 'Edit recorded locally (backend unavailable).', type: 'error' })
  }

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)', overflow: 'hidden' }}>
      <TopNav question={question} />

      <div className="workspace-grid" style={{ flex: 1, minHeight: 0 }}>
        {/* COL 1 — Protocol sidebar */}
        <ProtocolSidebar
          steps={plan.protocol || []}
          activeStep={activeStep ?? -1}
          onSelectStep={(i) => setActiveStep(prev => prev === i ? null : i)}
          correctionCount={correctionCount}
        />

        {/* COL 2 — Main content */}
        <MainContent
          plan={plan}
          question={question}
          activeStep={activeStep}
          onStepChange={setActiveStep}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          materials={materials}
          budget={budget}
          totalBudget={totalBudget}
          onCorrection={handleCorrection}
          onMaterialsChange={handleMaterialsChange}
          onBudgetChange={setBudget}
          onEmailResult={(ok, msg) => setToast({ message: msg, type: ok ? 'success' : 'error' })}
          sk={sk}
          correctionsApplied={correctionsApplied}
        />

        {/* COL 3 — Plan assistant (hidden on mobile via workspace-col3; accessible via floating chat/voice) */}
        <div className="workspace-col3" style={{ height: '100%', overflow: 'hidden' }}>
          <PlanAssistant
            question={question}
            plan={{ ...plan, total_budget: totalBudget, materials }}
            onCorrection={handleCorrection}
            sk={sk}
          />
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Floating voice call button */}
      <VoiceCall
        context={{
          question,
          protocol: plan.protocol || [],
          materials,
          timeline: plan.timeline || [],
          total_budget: totalBudget,
        }}
      />
    </motion.div>
  )
}
