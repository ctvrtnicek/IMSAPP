import { Fragment, useEffect, useRef, useState } from 'react'
import {
  getAssistantConversation, getAssistantStatus, getAssistantSummary, streamAssistantChat,
} from '../api/assistant.js'

// R3 #12 — AI Assistant: a chat-bubble button for the top bar + a slide-in panel.
// Hidden unless the assistant is enabled for the user's role (System Config). The
// conversation id is kept in sessionStorage so the chat survives page changes.

const CONV_KEY = 'ims_assistant_conversation'
const TOOL_HINTS = {
  list_alerts: 'Checking alerts…', acknowledge_alert: 'Acknowledging alert…',
  get_order: 'Looking up the order…', search_inventory: 'Checking stock…',
  get_terminal: 'Looking up the terminal…', attention_summary: 'Checking what needs attention…',
  read_reference: 'Reading the documentation…',
}
const DOC_LINKS = [ // order number prefix -> detail page
  [/^(SO|RN|RP|DS)\d+$/, (n) => `/order/${n}`], [/^PO\d+$/, (n) => `/po/${n}`],
  [/^WO\d+$/, (n) => `/work-order/${n}`], [/^RR\d+$/, (n) => `/repair/${n}`], [/^RE\d+$/, (n) => `/return/${n}`],
]

// Where the user is — sent with each question so answers can refer to "this order"
function pageContext() {
  const path = window.location.pathname
  const m = path.match(/^\/(order|po|work-order|repair|return|terminal)\/(.+)$/)
  if (m) return { page: `${m[1]} detail`, record: decodeURIComponent(m[2]) }
  let nav = null
  try { nav = sessionStorage.getItem('dash_nav') } catch { /* storage unavailable */ }
  return { page: nav ? `dashboard / ${nav}` : 'dashboard', record: null }
}

// Minimal, safe rendering of the assistant's markdown: paragraphs, bullet / numbered
// lists, **bold**, `code`, and order numbers as links. No HTML injection.
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\b(?:SO|RN|RP|DS|PO|WO|RR|RE)\d{4,}\b)/g)
  return parts.map((p, i) => {
    if (!p) return null
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="bg-gray-100 px-1 rounded text-xs">{p.slice(1, -1)}</code>
    const link = DOC_LINKS.find(([re]) => re.test(p))
    if (link) return <a key={i} href={link[1](p)} className="underline font-mono">{p}</a>
    return <Fragment key={i}>{p}</Fragment>
  })
}

function Markdown({ text }) {
  const blocks = []
  let list = null
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    const bullet = line.match(/^\s*[-*•]\s+(.*)$/)
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/)
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (bullet || numbered) {
      const kind = bullet ? 'ul' : 'ol'
      if (!list || list.kind !== kind) { list = { kind, items: [] }; blocks.push(list) }
      list.items.push((bullet || numbered)[1])
      continue
    }
    list = null
    if (heading) blocks.push({ kind: 'h', text: heading[1] })
    else if (line.trim()) blocks.push({ kind: 'p', text: line })
  }
  return blocks.map((b, i) => {
    if (b.kind === 'ul' || b.kind === 'ol') {
      const Tag = b.kind
      return (
        <Tag key={i} className={`${b.kind === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 my-1 space-y-0.5`}>
          {b.items.map((it, j) => <li key={j}><Inline text={it} /></li>)}
        </Tag>
      )
    }
    if (b.kind === 'h') return <p key={i} className="font-semibold mt-2"><Inline text={b.text} /></p>
    return <p key={i} className="my-1"><Inline text={b.text} /></p>
  })
}

function SummaryCard({ summary, onAsk }) {
  if (!summary) return <p className="text-xs text-gray-400">Loading what needs attention…</p>
  const a = summary.alerts_new
  const alertTotal = a.critical + a.urgent + a.normal
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">Needs attention</p>
      <ul className="space-y-1 text-gray-700">
        <li>
          <button type="button" className="underline" onClick={() => onAsk('Which unacknowledged alerts should I look at first, and why?')}>
            {alertTotal} unacknowledged alert{alertTotal === 1 ? '' : 's'}
          </button>
          {alertTotal > 0 && <span className="text-gray-500"> — {a.critical} critical, {a.urgent} urgent, {a.normal} normal</span>}
        </li>
        <li>
          <button type="button" className="underline" onClick={() => onAsk('Which stock is below its reorder point, and what should be done?')}>
            {summary.below_reorder_point.length} stock position{summary.below_reorder_point.length === 1 ? '' : 's'} below reorder point
          </button>
        </li>
        <li>
          <button type="button" className="underline" onClick={() => onAsk('Which open orders are past their EDD, and why?')}>
            {summary.orders_past_edd.length} open order{summary.orders_past_edd.length === 1 ? '' : 's'} past EDD
          </button>
          {summary.orders_past_edd.length > 0 && (
            <span className="text-gray-500"> — {summary.orders_past_edd.slice(0, 4).map((o) => o.order).join(', ')}{summary.orders_past_edd.length > 4 ? '…' : ''}</span>
          )}
        </li>
      </ul>
    </div>
  )
}

export default function AssistantButton() {
  const [enabled, setEnabled] = useState(false)
  const [open, setOpen] = useState(false)
  const [summary, setSummary] = useState(null)
  const [messages, setMessages] = useState([])  // [{role, text}]
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [toolHint, setToolHint] = useState(null)
  const [error, setError] = useState(null)
  const [convId, setConvId] = useState(() => {
    try { return Number(sessionStorage.getItem(CONV_KEY)) || null } catch { return null }
  })
  const bottomRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    getAssistantStatus().then((r) => setEnabled(!!r.data.enabled)).catch(() => setEnabled(false))
  }, [])

  useEffect(() => {
    if (!open) return
    getAssistantSummary().then((r) => setSummary(r.data)).catch(() => {})
    if (convId && messages.length === 0) {
      getAssistantConversation(convId).then((r) => setMessages(r.data.messages)).catch(() => startNew())
    }
  }, [open])

  useEffect(() => { bottomRef.current?.scrollIntoView({ block: 'end' }) }, [messages, toolHint])

  function remember(id) {
    setConvId(id)
    try { sessionStorage.setItem(CONV_KEY, String(id)) } catch { /* storage unavailable */ }
  }

  function startNew() {
    abortRef.current?.abort()
    setMessages([]); setError(null); setConvId(null)
    try { sessionStorage.removeItem(CONV_KEY) } catch { /* storage unavailable */ }
  }

  async function ask(question) {
    const q = (question ?? input).trim()
    if (!q || busy) return
    setInput(''); setError(null); setBusy(true)
    setMessages((m) => [...m, { role: 'user', text: q }, { role: 'assistant', text: '' }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    const appendText = (t) => setMessages((m) => {
      const next = [...m]
      next[next.length - 1] = { ...next[next.length - 1], text: next[next.length - 1].text + t }
      return next
    })
    try {
      await streamAssistantChat({ message: q, conversation_id: convId, ...pageContext() }, (ev) => {
        if (ev.type === 'conversation') remember(ev.id)
        else if (ev.type === 'text') { setToolHint(null); appendText(ev.text) }
        else if (ev.type === 'tool') setToolHint(TOOL_HINTS[ev.name] || 'Working…')
        else if (ev.type === 'error') setError(ev.message)
      }, ctrl.signal)
    } catch (e) {
      if (e.name !== 'AbortError') setError('Connection to the assistant was lost.')
    } finally {
      setBusy(false); setToolHint(null)
      setMessages((m) => (m.length && m[m.length - 1].role === 'assistant' && !m[m.length - 1].text ? m.slice(0, -1) : m))
      if (question === undefined) getAssistantSummary().then((r) => setSummary(r.data)).catch(() => {})
    }
  }

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="IMS Assistant"
        aria-label="Open IMS Assistant"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', color: '#fff',
          background: open ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.35)', borderRadius: 9999,
          padding: '3px 11px 3px 8px', fontSize: 'var(--fs-body-sm, 13px)', fontWeight: 600, lineHeight: 1,
        }}
      >
        {/* sparkle — the usual "AI" mark */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11 2.5c.4 3.9 1.9 6.6 4.4 8.1 1.4.9 3.2 1.4 5.3 1.6-3.9.4-6.6 1.9-8.1 4.4-.9 1.4-1.4 3.2-1.6 5.3-.4-3.9-1.9-6.6-4.4-8.1-1.4-.9-3.2-1.4-5.3-1.6 3.9-.4 6.6-1.9 8.1-4.4.9-1.4 1.4-3.2 1.6-5.3z" />
          <path d="M19 1.5c.2 1.6.8 2.7 1.8 3.3.6.4 1.3.6 2.2.7-1.6.2-2.7.8-3.3 1.8-.4.6-.6 1.3-.7 2.2-.2-1.6-.8-2.7-1.8-3.3-.6-.4-1.3-.6-2.2-.7 1.6-.2 2.7-.8 3.3-1.8.4-.6.6-1.3.7-2.2z" opacity="0.8" />
        </svg>
        Ask AI
      </button>

      {open && (
        <aside
          className="fixed right-0 top-0 h-full bg-white shadow-2xl flex flex-col text-gray-800"
          style={{ width: 'min(440px, 100vw)', zIndex: 60, borderLeft: '1px solid #e5e7eb' }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white" style={{ background: 'var(--cadet-dark, #1E4E8C)' }}>
            <span className="font-semibold">IMS Assistant</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={startNew} className="text-xs border border-white/40 rounded px-2 py-1">New chat</button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-lg leading-none px-1">×</button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 text-sm">
            <SummaryCard summary={summary} onAsk={ask} />
            {messages.length === 0 && (
              <p className="text-xs text-gray-400">
                Ask about an order, a terminal, stock or alerts — or how to do something, e.g. “How do I create a repair order?”
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                <div className={m.role === 'user'
                  ? 'rounded-lg px-3 py-2 max-w-[85%] text-white'
                  : 'rounded-lg px-3 py-2 bg-gray-50 border border-gray-100'}
                  style={m.role === 'user' ? { background: 'var(--cadet-dark, #1E4E8C)' } : undefined}>
                  {m.role === 'user' ? m.text : <Markdown text={m.text || '…'} />}
                </div>
              </div>
            ))}
            {toolHint && <p className="text-xs text-gray-400 italic">{toolHint}</p>}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div ref={bottomRef} />
          </div>

          <form
            className="border-t border-gray-200 p-3 flex gap-2"
            onSubmit={(e) => { e.preventDefault(); ask() }}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
              rows={2}
              placeholder="Ask the assistant…"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="px-4 rounded-lg text-sm font-semibold text-white"
              style={{ background: busy || !input.trim() ? '#93c5fd' : 'var(--cadet-dark, #1E4E8C)' }}
            >
              {busy ? '…' : 'Send'}
            </button>
          </form>
        </aside>
      )}
    </>
  )
}
