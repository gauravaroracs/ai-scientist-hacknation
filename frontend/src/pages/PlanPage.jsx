import { useState } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import InlineEdit from '../components/InlineEdit'
import Toast from '../components/Toast'

const CHART_COLORS = ['#1d4ed8', '#0891b2', '#7c3aed', '#059669', '#d97706', '#dc2626', '#0f766e']

// ── Top bar ────────────────────────────────────────────────────────────────────

function TopBar({ plan, question, correctionCount }) {
  const firstPhase = plan.timeline?.[0]?.phase ?? '—'
  const lastPhase  = plan.timeline?.[plan.timeline.length - 1]?.phase ?? ''
  const timelineLabel = plan.timeline?.length > 0 ? `${firstPhase} – ${lastPhase}` : '—'

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div className="px-6 py-3 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <Link to="/" className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)' }}>
            <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/>
          </svg>
          <span className="font-display font-semibold text-sm" style={{ color: 'var(--ink)' }}>The AI Scientist</span>
        </Link>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span className="font-sans text-sm" style={{ color: 'var(--muted)' }}>Literature QC</span>
        <span style={{ color: 'var(--border)' }}>›</span>
        <span className="font-sans text-sm font-600" style={{ color: 'var(--ink)' }}>Experiment Plan</span>

        {correctionCount > 0 && (
          <span
            className="ml-auto font-sans text-xs px-2.5 py-1 rounded-full font-600"
            style={{ background: '#eff6ff', color: 'var(--accent)', border: '1px solid #bfdbfe' }}
          >
            {correctionCount} correction{correctionCount !== 1 ? 's' : ''} saved
          </span>
        )}
      </div>

      <div className="px-6 py-3 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-sans text-xs font-600 uppercase tracking-widest mb-0.5" style={{ color: 'var(--muted)' }}>Hypothesis</p>
          <p className="font-display text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>"{question}"</p>
        </div>
        <StatPill label="Total Budget"   value={`$${Number(plan.total_budget).toLocaleString('en-US', { minimumFractionDigits: 2 })}`} accent />
        <StatPill label="Timeline"       value={timelineLabel} />
        <StatPill label="Protocol Steps" value={plan.protocol?.length ?? 0} />
        <StatPill label="Materials"      value={plan.materials?.length ?? 0} />
      </div>
    </header>
  )
}

function StatPill({ label, value, accent }) {
  return (
    <div
      className="flex flex-col items-center px-4 py-2 rounded"
      style={{ background: accent ? 'var(--accent-light)' : 'var(--surface2)', border: '1px solid var(--border)', minWidth: 100 }}
    >
      <span className="font-sans text-xs font-600 uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{label}</span>
      <span className="font-display font-bold text-lg leading-tight" style={{ color: accent ? 'var(--accent)' : 'var(--ink)' }}>
        {value}
      </span>
    </div>
  )
}

// ── Protocol Stepper ───────────────────────────────────────────────────────────

function ProtocolStepper({ steps, question, onCorrection }) {
  const [active, setActive]   = useState(null)
  const [local, setLocal]     = useState(steps)

  return (
    <div className="flex flex-col">
      {local.map((step, i) => (
        <div
          key={i}
          className="step-item flex gap-3"
          style={{ animationDelay: `${i * 0.04}s` }}
        >
          <div className="flex flex-col items-center flex-shrink-0" style={{ width: 32 }}>
            <button
              onClick={() => setActive(active === i ? null : i)}
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-xs font-bold transition-all duration-200"
              style={{
                border: `2px solid ${active === i ? 'var(--accent)' : 'var(--border)'}`,
                background: active === i ? 'var(--accent-light)' : 'var(--surface2)',
                color: active === i ? 'var(--accent)' : 'var(--muted)',
                cursor: 'pointer',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </button>
            {i < local.length - 1 && <div className="step-connector flex-1 my-1" style={{ minHeight: 12 }} />}
          </div>

          <div className="flex-1 pb-4 pt-1">
            <InlineEdit
              originalText={step}
              question={question}
              category="protocol"
              itemLabel={`Step ${i + 1}`}
              onSaved={(corrected) => {
                const updated = [...local]
                updated[i] = corrected
                setLocal(updated)
                onCorrection()
              }}
            >
              <p
                className="font-sans text-sm leading-relaxed pr-8 transition-colors duration-200"
                style={{ color: active === i ? 'var(--ink)' : 'var(--body)' }}
              >
                {step}
              </p>
            </InlineEdit>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Budget Tab ─────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="card px-3 py-2" style={{ minWidth: 180 }}>
      <p className="font-sans text-xs font-600 mb-0.5" style={{ color: 'var(--muted)' }}>{d.payload.item}</p>
      <p className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>
        ${Number(d.value).toFixed(2)}
      </p>
    </div>
  )
}

function BudgetTab({ budget, totalBudget, question, onCorrection }) {
  const [local, setLocal] = useState(budget)

  return (
    <div className="flex flex-col gap-6">
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={local} cx="50%" cy="50%" innerRadius={68} outerRadius={108} paddingAngle={2} dataKey="cost" nameKey="item">
              {local.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="white" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border)' }}>
            <th className="font-sans font-600 text-xs uppercase tracking-widest pb-2 text-left pr-4" style={{ color: 'var(--muted)' }}>Line Item</th>
            <th className="font-sans font-600 text-xs uppercase tracking-widest pb-2 text-right" style={{ color: 'var(--muted)' }}>Cost (USD)</th>
          </tr>
        </thead>
        <tbody>
          {local.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="py-2 pr-4">
                <InlineEdit
                  originalText={`${row.item} — $${Number(row.cost).toFixed(2)}`}
                  question={question}
                  category="budget"
                  itemLabel={row.item}
                  onSaved={(corrected) => {
                    const updated = [...local]
                    const parts = corrected.split('—')
                    updated[i] = { ...updated[i], item: parts[0]?.trim() || row.item }
                    setLocal(updated)
                    onCorrection()
                  }}
                >
                  <span className="font-sans text-sm" style={{ color: 'var(--body)' }}>
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle"
                      style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                    />
                    {row.item}
                  </span>
                </InlineEdit>
              </td>
              <td className="py-2 font-mono text-sm text-right font-medium" style={{ color: 'var(--ink)' }}>
                ${Number(row.cost).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid var(--border)' }}>
            <td className="pt-3 font-sans font-bold text-sm uppercase tracking-wide" style={{ color: 'var(--ink)' }}>Total</td>
            <td className="pt-3 font-mono font-bold text-base text-right" style={{ color: 'var(--accent)' }}>
              ${Number(totalBudget).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Materials Tab ──────────────────────────────────────────────────────────────

function MaterialsTab({ materials, question, onCorrection }) {
  const [local, setLocal] = useState(materials)

  return (
    <div className="flex flex-col gap-2.5">
      {local.map((m, i) => (
        <InlineEdit
          key={i}
          originalText={`${m.name} | SKU: ${m.catalog_number} | Supplier: ${m.supplier} | Price: $${m.unit_price} | Qty: ${m.quantity}`}
          question={question}
          category="material"
          itemLabel={m.name}
          onSaved={(corrected) => {
            onCorrection()
          }}
        >
          <div className="card card-hover px-4 py-3.5 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3 pr-8">
              <span className="font-sans font-semibold text-sm" style={{ color: 'var(--ink)' }}>{m.name}</span>
              <span
                className="font-sans text-xs px-2.5 py-0.5 rounded-full flex-shrink-0"
                style={{ background: 'var(--surface2)', color: 'var(--body)', border: '1px solid var(--border)' }}
              >
                {m.supplier}
              </span>
            </div>
            <div className="flex items-center gap-5 flex-wrap">
              <span className="flex items-center gap-1.5 font-mono text-xs" style={{ color: 'var(--muted)' }}>
                <span>SKU</span>
                <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{m.catalog_number}</span>
              </span>
              <span className="font-sans text-xs" style={{ color: 'var(--muted)' }}>{m.quantity}</span>
              <span className="font-mono text-sm font-semibold ml-auto" style={{ color: 'var(--ink)' }}>
                ${Number(m.unit_price).toFixed(2)}
              </span>
            </div>
          </div>
        </InlineEdit>
      ))}
    </div>
  )
}

// ── Timeline Tab ───────────────────────────────────────────────────────────────

function TimelineTab({ timeline, question, onCorrection }) {
  return (
    <div className="flex flex-col gap-3">
      {timeline.map((phase, i) => (
        <div key={i} className="card px-4 py-4 flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-xs font-bold px-2 py-0.5 rounded"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #bfdbfe' }}
            >
              {phase.phase}
            </span>
          </div>
          <ul className="flex flex-col gap-1.5">
            {phase.tasks.map((task, j) => (
              <li key={j} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 mt-2 w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }} />
                <InlineEdit
                  originalText={task}
                  question={question}
                  category="timeline"
                  itemLabel={`${phase.phase} — Task ${j + 1}`}
                  onSaved={onCorrection}
                >
                  <span className="font-sans text-sm pr-8" style={{ color: 'var(--body)' }}>{task}</span>
                </InlineEdit>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Validation Tab ─────────────────────────────────────────────────────────────

function ValidationTab({ validation, question, onCorrection }) {
  if (!validation?.length) return (
    <p className="font-sans text-sm" style={{ color: 'var(--muted)' }}>No validation criteria returned.</p>
  )
  return (
    <div className="flex flex-col gap-3">
      {validation.map((v, i) => (
        <div key={i} className="card px-4 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className="font-mono text-xs w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-bold"
              style={{ background: 'var(--accent-light)', color: 'var(--accent)', border: '1px solid #bfdbfe' }}
            >
              {i + 1}
            </span>
            <span className="font-sans font-semibold text-sm" style={{ color: 'var(--ink)' }}>{v.metric}</span>
          </div>
          <div className="grid grid-cols-1 gap-2 pl-9">
            <InfoRow label="Method"  value={v.method} />
            <InlineEdit
              originalText={v.success_threshold}
              question={question}
              category="validation"
              itemLabel={`${v.metric} — success threshold`}
              onSaved={onCorrection}
            >
              <InfoRow label="Success" value={v.success_threshold} color="var(--success)" bg="var(--success-light)" border="#6ee7b7" />
            </InlineEdit>
            <InlineEdit
              originalText={v.failure_indicator}
              question={question}
              category="validation"
              itemLabel={`${v.metric} — failure indicator`}
              onSaved={onCorrection}
            >
              <InfoRow label="Failure" value={v.failure_indicator} color="var(--danger)" bg="var(--danger-light)" border="#fca5a5" />
            </InlineEdit>
          </div>
        </div>
      ))}
    </div>
  )
}

function InfoRow({ label, value, color, bg, border }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span
        className="font-sans font-600 text-xs flex-shrink-0 mt-0.5 px-2 py-0.5 rounded"
        style={{ color: color || 'var(--body)', background: bg || 'var(--surface2)', border: `1px solid ${border || 'var(--border)'}`, minWidth: 56, textAlign: 'center' }}
      >
        {label}
      </span>
      <span className="font-sans leading-relaxed" style={{ color: 'var(--body)' }}>{value}</span>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

const TABS = ['Budget', 'Materials', 'Timeline', 'Validation']

export default function PlanPage() {
  const location = useLocation()
  const { plan, question } = location.state || {}
  const [activeTab, setActiveTab]         = useState('Budget')
  const [correctionCount, setCorrectionCount] = useState(0)
  const [toast, setToast]                 = useState(null)

  if (!plan) return <Navigate to="/" replace />

  const handleCorrection = () => {
    setCorrectionCount(c => c + 1)
    setToast({ message: 'Correction saved — will improve future plans.', type: 'success' })
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', fontFamily: "'Source Sans 3', sans-serif" }}>
      <TopBar plan={plan} question={question} correctionCount={correctionCount} />

      <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1.25fr]" style={{ minHeight: 0 }}>

        {/* ── Left: Protocol ── */}
        <div
          className="px-6 py-6 overflow-y-auto"
          style={{ borderRight: '1px solid var(--border)', maxHeight: 'calc(100vh - 130px)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--ink)' }}>Protocol</h2>
            <span className="font-sans text-xs" style={{ color: 'var(--muted)' }}>Hover any step to suggest a correction</span>
          </div>
          <ProtocolStepper steps={plan.protocol || []} question={question} onCorrection={handleCorrection} />
        </div>

        {/* ── Right: Tabs ── */}
        <div
          className="px-6 py-6 flex flex-col overflow-y-auto"
          style={{ maxHeight: 'calc(100vh - 130px)', background: 'var(--bg)' }}
        >
          <div className="flex gap-5 border-b mb-6" style={{ borderColor: 'var(--border)' }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`font-sans text-sm pb-3 transition-colors duration-150 ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="animate-fade-in">
            {activeTab === 'Budget'     && <BudgetTab     budget={plan.budget || []} totalBudget={plan.total_budget || 0} question={question} onCorrection={handleCorrection} />}
            {activeTab === 'Materials'  && <MaterialsTab  materials={plan.materials || []} question={question} onCorrection={handleCorrection} />}
            {activeTab === 'Timeline'   && <TimelineTab   timeline={plan.timeline || []} question={question} onCorrection={handleCorrection} />}
            {activeTab === 'Validation' && <ValidationTab validation={plan.validation || []} question={question} onCorrection={handleCorrection} />}
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  )
}
