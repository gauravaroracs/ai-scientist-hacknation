import { useRef, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useChat } from '@ai-sdk/react'
import { TextStreamChatTransport } from 'ai'

const SUGGESTIONS = [
  'Why was this protocol chosen?',
  'What are the main failure risks?',
  'Can I substitute any reagents?',
  'How long does each step take?',
]

function ChatUI({ question, plan }) {
  const [open, setOpen] = useState(false)
  const bottomRef = useRef(null)

  const [inputValue, setInputValue] = useState('')
  const transportRef = useRef(new TextStreamChatTransport({ api: '/api/chat' }))
  const { messages, sendMessage, status } = useChat({
    transport: transportRef.current,
  })
  const isLoading = status === 'streaming' || status === 'submitted'
  const planContext = {
    question,
    protocol:     plan?.protocol     || [],
    materials:    plan?.materials    || [],
    total_budget: plan?.total_budget || 0,
    timeline:     plan?.timeline     || [],
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = (text) => {
    const msg = text ?? inputValue
    if (!msg?.trim() || isLoading) return
    sendMessage({ text: msg.trim() }, { body: { context: planContext } })
    setInputValue('')
  }

  const sendSuggestion = (text) => {
    submit(text)
  }

  return (
    <>
      {/* Floating toggle button — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask LabAgent"
        style={{
          position: 'fixed',
          bottom: 28, right: 28,
          zIndex: 99999,
          width: 54, height: 54,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          boxShadow: '0 4px 20px rgba(37,99,235,0.45), 0 0 0 3px rgba(37,99,235,0.12)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 6px 26px rgba(37,99,235,0.55), 0 0 0 4px rgba(37,99,235,0.15)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(37,99,235,0.45), 0 0 0 3px rgba(37,99,235,0.12)'
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
        {!open && messages.length > 0 && (
          <span style={{
            position: 'absolute', top: 7, right: 7,
            width: 10, height: 10, borderRadius: '50%',
            background: '#0891B2', border: '2px solid white',
          }} />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 96, right: 28,
            zIndex: 99998,
            width: 372, height: 524,
            display: 'flex', flexDirection: 'column',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '13px 16px',
            borderBottom: '1px solid var(--border-light)',
            background: 'var(--surface)',
            display: 'flex', alignItems: 'center', gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent-light)',
              border: '1.5px solid var(--accent-mid)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3h6M9 3v7l-5 9a1 1 0 00.9 1.5h12.2A1 1 0 0018 19l-5-9V3"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
                Plan Assistant
              </p>
              <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: 'var(--muted)' }}>
                Ask anything about this experiment
              </p>
            </div>
            {isLoading && (
              <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--accent)', display: 'inline-block',
                    animation: `chatBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '14px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                <p style={{ fontFamily: "'Source Sans 3', sans-serif", fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  Ask about the protocol, reagents, risks, or methodology
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => sendSuggestion(s)}
                      style={{
                        fontFamily: "'Source Sans 3', sans-serif",
                        fontSize: 12, textAlign: 'left',
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: 'var(--surface2)',
                        border: '1px solid var(--border)',
                        color: 'var(--body)',
                        cursor: 'pointer',
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
              </div>
            ) : (
              messages.map(m => {
                const text = m.parts
                  ? m.parts.filter(p => p.type === 'text').map(p => p.text).join('')
                  : (m.content ?? '')
                return (
                <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '86%',
                    padding: '9px 13px',
                    borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    background: m.role === 'user' ? 'var(--accent)' : 'var(--surface2)',
                    color: m.role === 'user' ? 'white' : 'var(--ink)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                    fontFamily: "'Source Sans 3', sans-serif",
                    fontSize: 13, lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {text}
                  </div>
                </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); submit() }}
            style={{
              padding: '10px 12px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex', gap: 8, flexShrink: 0,
              background: 'var(--surface)',
            }}
          >
            <input
              id="plan-chat-input"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              placeholder="Ask about this experiment…"
              disabled={isLoading}
              style={{
                flex: 1, padding: '8px 12px',
                borderRadius: 10,
                border: '1.5px solid var(--border)',
                background: 'var(--surface2)',
                color: 'var(--ink)',
                outline: 'none',
                fontFamily: "'Source Sans 3', sans-serif",
                fontSize: 13,
                transition: 'border-color 0.15s',
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
        </div>
      )}

      <style>{`
        @keyframes chatBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.35; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}

export default function PlanChat({ question, plan }) {
  // Render via portal so fixed positioning is never clipped by parent overflow
  return createPortal(
    <ChatUI question={question} plan={plan} />,
    document.body
  )
}
