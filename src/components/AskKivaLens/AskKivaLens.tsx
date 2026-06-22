import { useCallback, useEffect, useRef, useState } from 'react'
import { useUtilsStore } from '../../stores/utilsStore'
import { useCriteriaStore } from '../../stores/criteriaStore'
import { useLoanStore } from '../../stores/loanStore'
import type { Criteria } from '../../types'
import ReactMarkdown from 'react-markdown'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { lsj } from '../../lib/localStorage'
import { streamChat, type ChatEvent, type ChatMessage, type ChartSpec } from '../../api/aiChat'
import './AskKivaLens.scss'

const CHART_COLORS = ['#2C8C5E', '#5BA882', '#8AC4A6', '#1f6b46', '#3a9e6d', '#7bbf9b', '#b9dfca', '#155138']

// Per-browser id used to group a user's turns in the server digest.
function newClientId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

// Never render images in chat (the model occasionally tries to embed a base64
// chart; real charts come through render_chart). Strip them defensively.
const MD_COMPONENTS = { img: () => null }

const GREETING =
  "Hi! I'm the KivaLens assistant. Tell me what kind of loans you'd like to fund — a sector, a country, a cause, a type of borrower — and I'll build the search for you."

const CHAT_KEY = 'AskKivaLensChat'

type Bubble = ChatMessage & { interrupted?: boolean; chart?: ChartSpec }
type SavedChat = { messages?: Bubble[]; open?: boolean; savedAt?: number }

// Restore the persisted chat only on a genuine browser refresh (saved within this
// window), not when returning to a stale session.
const CHAT_RESTORE_TTL_MS = 2 * 60 * 1000

// A short label for the page the user is on, from the hash route.
function describePage(): string {
  const h = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '')
  if (h.startsWith('search/loan/')) return 'a loan detail page'
  if (h.startsWith('basket')) return 'the Basket'
  if (h.startsWith('partners/')) return 'a field-partner page'
  if (h.startsWith('partners')) return 'the Partners page'
  if (h.startsWith('portfolio')) return 'their Portfolio page'
  if (h.startsWith('saved')) return 'the Saved Searches page'
  if (h.startsWith('stats')) return 'the Stats page'
  if (h.startsWith('options')) return 'the Options page'
  if (h.startsWith('about')) return 'the About page'
  if (h.startsWith('teams')) return 'the Teams page'
  return 'the Search page'
}

function Eyes() {
  return (
    <span className="ask-kl-eyes" aria-hidden="true">
      <span className="ask-kl-eye">
        <span className="ask-kl-pupil" />
      </span>
      <span className="ask-kl-eye">
        <span className="ask-kl-pupil" />
      </span>
    </span>
  )
}

function Ellipses() {
  return (
    <div className="ask-kl-ellipses" aria-label="KivaLens AI is thinking">
      <span className="ask-kl-ellipse" />
      <span className="ask-kl-ellipse" />
      <span className="ask-kl-ellipse" />
    </div>
  )
}

// Pie slice labels = the category NAME (recharts' default/string label shows the
// value). Custom renderer reads name from props (payload fallback for v3).
type PieLabelProps = { x?: number; y?: number; textAnchor?: string; name?: string; payload?: { name?: string } }
function renderPieLabel(p: PieLabelProps) {
  const name = p.name ?? p.payload?.name ?? ''
  if (!name) return null
  return (
    <text
      x={p.x}
      y={p.y}
      textAnchor={(p.textAnchor as 'start' | 'middle' | 'end') ?? 'middle'}
      dominantBaseline="central"
      fontSize={11}
      fill="#15352b"
    >
      {name}
    </text>
  )
}

// An inline chart the AI chose to render.
function ChartBubble({ spec }: { spec: ChartSpec }) {
  const data = spec.data.slice(0, 12)
  const height = spec.type === 'pie' ? 200 : Math.max(150, data.length * 26)
  return (
    <div className="ask-kl-chart">
      {spec.title ? <div className="ask-kl-chart-title">{spec.title}</div> : null}
      <ResponsiveContainer width="100%" height={height}>
        {spec.type === 'pie' ? (
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" outerRadius={70} label={renderPieLabel} labelLine>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        ) : (
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#2C8C5E" radius={[0, 4, 4, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  )
}

export default function AskKivaLens() {
  const open = useUtilsStore((s) => s.askKlOpen)
  const askKlSeed = useUtilsStore((s) => s.askKlSeed)
  const disabled = useUtilsStore((s) => s.aiWidgetDisabled)
  const aiServerEnabled = useUtilsStore((s) => s.aiServerEnabled)
  const setAiServerEnabled = useUtilsStore((s) => s.setAiServerEnabled)
  const openAskKl = useUtilsStore((s) => s.openAskKl)
  const closeAskKl = useUtilsStore((s) => s.closeAskKl)

  const rootRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const streamRef = useRef('')
  const rafRef = useRef<number | null>(null)
  // Snapshot the persisted chat ONCE so the mount effects don't race the save
  // effect. Only RESTORE it on a genuine browser refresh — i.e. saved within the
  // last 2 minutes. Closed longer than that = a new session: start fresh and drop
  // the stale copy.
  const [savedChat] = useState<SavedChat>(() => {
    const s = lsj.get<SavedChat>(CHAT_KEY)
    if (s && s.savedAt && Date.now() - s.savedAt <= CHAT_RESTORE_TTL_MS) return s
    if (s && (s.messages?.length || s.open)) {
      try {
        localStorage.removeItem(CHAT_KEY)
      } catch {
        /* ignore */
      }
    }
    return {}
  })
  // Stable per-browser id so the server can group a user's turns in the digest.
  const [clientId, setClientId] = useState<string>(() => {
    const saved = lsj.get<{ id?: string }>('AskKivaLensClientId')
    if (saved.id) return saved.id
    const id = newClientId()
    lsj.set('AskKivaLensClientId', { id })
    return id
  })

  const [messages, setMessages] = useState<Bubble[]>(() => savedChat.messages ?? [])
  const [streaming, setStreaming] = useState('')
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')

  // Eyes follow the cursor (cross-eyed when it's between them). Pure DOM.
  useEffect(() => {
    const root = rootRef.current
    if (!root || typeof window === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const MAX = 4 // max pupil travel within the eye (px)
    // Coalesce to one DOM write per animation frame. A raw mousemove listener
    // fires ~60-120x/sec and each call wrote 4 inline-style props (2 eyes x 2
    // vars) — a continuous style-attr mutation + repaint storm. rAF batching
    // collapses that to <=4 writes per frame, only while the cursor moves.
    let raf = 0
    let last: MouseEvent | null = null
    const apply = () => {
      raf = 0
      const e = last
      if (!e) return
      root.querySelectorAll<HTMLElement>('.ask-kl-eye').forEach((el) => {
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const dist = Math.hypot(dx, dy)
        // Move the pupil ALONG the direction of the cursor (its true angle), with
        // travel ramping up to MAX. Clamping each axis independently made both
        // saturate and lock the pupil in the corner (~45deg) for any far cursor;
        // normalizing the vector keeps the real angle so the eyes zero in on it.
        const reach = dist > 0 ? Math.min(dist / 8, MAX) / dist : 0
        el.style.setProperty('--kl-px', `${dx * reach}px`)
        el.style.setProperty('--kl-py', `${dy * reach}px`)
      })
    }
    const onMove = (e: MouseEvent) => {
      last = e
      if (raf === 0) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
    // aiServerEnabled is included so tracking attaches the moment the launcher
    // chip appears (not only after the panel opens).
  }, [open, disabled, aiServerEnabled])

  // Keep the latest message in view.
  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [messages, streaming, open, loading])

  const flushStreaming = useCallback(() => {
    rafRef.current = null
    setStreaming(streamRef.current)
  }, [])

  // Commit the in-progress streamed text as a message (on done, and before
  // inserting an inline element like a chart so ordering stays correct).
  const commitStreaming = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const t = streamRef.current.trim()
    streamRef.current = ''
    setStreaming('')
    if (t) setMessages((m) => [...m, { role: 'assistant', content: t }])
  }, [])

  // Wipe the conversation and start fresh ("Reset chat" button / reset_chat tool).
  const resetChat = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current = ''
    setStreaming('')
    setMessages([])
    setInput('')
    setLoading(false)
    try {
      localStorage.removeItem('AskKivaLensChat')
    } catch {
      /* ignore */
    }
    // Detach from the old conversation: a fresh id so new turns aren't grouped
    // with the cleared chat in the server digest. (Server logs aren't deleted
    // here — they're the analytics record and the daily digest wipes them.)
    const id = newClientId()
    lsj.set('AskKivaLensClientId', { id })
    setClientId(id)
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const send = useCallback(
    (text: string) => {
      const msg = text.trim()
      if (!msg || loading) return
      const history = [...messages, { role: 'user', content: msg } as Bubble]
      setMessages(history)
      setInput('')
      setLoading(true)
      streamRef.current = ''
      setStreaming('')

      const ac = new AbortController()
      abortRef.current = ac
      const lenderId = useUtilsStore.getState().lenderId || null
      const criteria = useCriteriaStore.getState().lastKnown
      const loanState = useLoanStore.getState()
      const selectedLoanId = loanState.selectedId ?? null

      const onEvent = (e: ChatEvent) => {
        switch (e.type) {
          case 'token':
            streamRef.current += e.text
            if (rafRef.current == null) rafRef.current = requestAnimationFrame(flushStreaming)
            break
          case 'apply_criteria':
            useCriteriaStore.getState().setCriteria(e.criteria as Criteria)
            break
          case 'save_search':
            useCriteriaStore.getState().saveSearch(e.name)
            break
          case 'open_lender_modal':
            useUtilsStore.getState().openLenderIdModal()
            break
          case 'set_lender_id':
            useUtilsStore.getState().setLenderId(e.lenderId)
            break
          case 'open_url':
            window.open(e.url, '_blank', 'noopener,noreferrer')
            break
          case 'add_to_basket':
            useLoanStore.getState().addToBasket(e.loanId, e.amount)
            break
          case 'bulk_add':
            useLoanStore
              .getState()
              .batchAddToBasket((e.items || []).map((it) => ({ loan_id: it.loanId, amount: it.amount })))
            break
          case 'toggle_notify':
            useCriteriaStore.getState().toggleNotifyOnNew(e.name)
            break
          case 'point_at':
            useUtilsStore.getState().showCallout(e.target, e.message)
            break
          case 'navigate': {
            const routes: Record<string, string> = {
              search: '/search', basket: '/basket', partners: '/partners', stats: '/live',
              saved: '/saved', options: '/options', about: '/about', teams: '/teams', wall: '/portfolio',
            }
            const r = routes[e.page]
            if (r) window.location.hash = `#${r}`
            break
          }
          case 'switch_tab':
            useUtilsStore.getState().setAiCriteriaTab(e.tab)
            break
          case 'remove_from_basket':
            useLoanStore.getState().removeFromBasket(e.loanId)
            break
          case 'set_lend_amount':
            useLoanStore.getState().setBasketAmount(e.loanId, e.amount)
            break
          case 'set_all_lend_amounts':
            useLoanStore.getState().setAllBasketAmounts(e.amount)
            break
          case 'clear_basket':
            useLoanStore.getState().clearBasket()
            break
          case 'reset_chat':
            // AI-triggered "start over": clear prior turns; the fresh-start
            // greeting it streams next becomes the new first message.
            if (rafRef.current != null) {
              cancelAnimationFrame(rafRef.current)
              rafRef.current = null
            }
            setMessages([])
            streamRef.current = ''
            setStreaming('')
            try {
              localStorage.removeItem('AskKivaLensChat')
            } catch {
              /* ignore */
            }
            break
          case 'load_search':
            useCriteriaStore.getState().loadSearch(e.name)
            break
          case 'delete_search':
            useCriteriaStore.getState().deleteSearch(e.name)
            break
          case 'reset_criteria':
            useCriteriaStore.getState().startFresh()
            break
          case 'chart':
            commitStreaming()
            setMessages((m) => [...m, { role: 'assistant', content: '', chart: e.chart }])
            break
          case 'error':
            streamRef.current += (streamRef.current ? '\n\n' : '') + e.message
            break
          case 'done':
            commitStreaming()
            setLoading(false)
            abortRef.current = null
            break
        }
      }

      void streamChat(
        {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          lenderId,
          criteria,
          shownCount: loanState.filteredLoans.length,
          totalCount: loanState.loanCount,
          selectedLoanId,
          page: describePage(),
          basket: loanState.basket.map((b) => ({ loanId: b.loan_id, amount: b.amount })),
          savedSearches: useCriteriaStore.getState().getSavedSearchNames(),
          clientId,
        },
        { onEvent, signal: ac.signal },
      )
    },
    [loading, messages, flushStreaming, commitStreaming, clientId],
  )

  // Auto-send a seed prompt (the no-results "Ask KivaLens for a suggestion"
  // button, the Getting Started CTA, etc.). Watching askKlSeed — not just open —
  // matters: when the panel is ALREADY open at click time, `open` never
  // transitions, so keying solely on it dropped the seed and nothing happened.
  useEffect(() => {
    if (!open) return
    // Focus the message box as soon as the panel opens.
    requestAnimationFrame(() => inputRef.current?.focus())
    if (!askKlSeed) return
    const seed = useUtilsStore.getState().consumeAskKlSeed()
    if (seed) send(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, askKlSeed])

  const stopStream = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    const partial = streamRef.current.trim()
    if (partial) setMessages((m) => [...m, { role: 'assistant', content: partial, interrupted: true }])
    streamRef.current = ''
    setStreaming('')
    setLoading(false)
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  // Global server switch (ASK_KIVALENS_ENABLED + key present). Hide everything if off.
  useEffect(() => {
    let active = true
    fetch('/api/ai-enabled')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((j) => active && setAiServerEnabled(!!j.enabled))
      .catch(() => active && setAiServerEnabled(false))
    return () => {
      active = false
    }
  }, [setAiServerEnabled])

  // Remember the conversation across reloads, stamping the last-activity time.
  // On mount we only RESTORE it if that stamp is within CHAT_RESTORE_TTL_MS (a
  // genuine refresh during active use), else we start fresh — so returning to a
  // window that's been idle/closed >2 min does not reload the old chat.
  //
  // Debounced 500ms: setMerge re-serializes the whole transcript on every
  // committed message and open/close, so bursts (e.g. a turn finishing then the
  // view scrolling) collapse into a single write. The latest messages/open are
  // captured per render, and the cleanup clears the pending timer, so the flush
  // always reflects the newest state. A genuine refresh recovers the last
  // flushed copy (well within the 2-min TTL); at most the final <500ms of
  // activity is unsaved, which is harmless for restore.
  useEffect(() => {
    const t = setTimeout(() => {
      lsj.setMerge(CHAT_KEY, { messages, open, savedAt: Date.now() })
    }, 500)
    return () => clearTimeout(t)
  }, [messages, open])
  useEffect(() => {
    if (savedChat.open) openAskKl()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (disabled || aiServerEnabled !== true) return null

  return (
    <div className="ask-kl" ref={rootRef}>
      {!open && (
        <button type="button" className="ask-kl-chip" aria-label="Open the KivaLens AI assistant" onClick={() => openAskKl()}>
          <Eyes />
          <span>Ask KivaLens</span>
        </button>
      )}
      {open && (
        <div className="ask-kl-panel" role="dialog" aria-label="KivaLens AI assistant">
          <div
            className="ask-kl-header"
            onClick={() => closeAskKl()}
            title="Click to minimize"
          >
            <Eyes />
            <strong className="ask-kl-title">Ask KivaLens</strong>
            <span className="ask-kl-beta">beta</span>
            <span className="ask-kl-badge">AI</span>
            <button type="button" className="ask-kl-close" aria-label="Minimize" onClick={() => closeAskKl()}>
              ×
            </button>
          </div>
          <div className="ask-kl-body" ref={bodyRef}>
            {messages.length === 0 && !streaming && !loading && <div className="ask-kl-msg">{GREETING}</div>}
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === 'user' ? 'ask-kl-msg-user' : m.chart ? 'ask-kl-msg ask-kl-msg-chart' : 'ask-kl-msg'}
              >
                {m.role === 'user' ? (
                  m.content
                ) : m.chart ? (
                  <ChartBubble spec={m.chart} />
                ) : (
                  <ReactMarkdown components={MD_COMPONENTS}>{m.content}</ReactMarkdown>
                )}
                {m.interrupted && <span className="ask-kl-interrupted"> (interrupted)</span>}
              </div>
            ))}
            {streaming && (
              <div className="ask-kl-msg">
                <ReactMarkdown components={MD_COMPONENTS}>{streaming}</ReactMarkdown>
              </div>
            )}
            {loading && !streaming && <Ellipses />}
          </div>
          <form
            className="ask-kl-foot"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              placeholder="Ask about finding loans…"
              aria-label="Message the KivaLens assistant"
              onChange={(e) => setInput(e.target.value)}
            />
            {loading ? (
              <button type="button" className="ask-kl-send" aria-label="Stop" onClick={stopStream}>
                ■
              </button>
            ) : (
              <button type="submit" className="ask-kl-send" aria-label="Send">
                ↑
              </button>
            )}
          </form>
          <div
            className="ask-kl-disclosure"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
          >
            <button
              type="button"
              onClick={resetChat}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--kl-green, #2C8C5E)',
                cursor: 'pointer',
                font: 'inherit',
                padding: 0,
                textDecoration: 'underline',
                whiteSpace: 'nowrap',
              }}
            >
              ↺ Reset chat
            </button>
            <span>
              Chats are logged · <a href="#/privacy">Privacy</a>
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
