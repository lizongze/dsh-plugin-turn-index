/**
 * dsh-turn-index — browser half.
 *
 * The conversation already has a fixed-pitch turn rail on its right edge
 * ("轮次导航"): one mark per Turn, clicking a mark jumps to that Turn (paging
 * history first when the Turn is not loaded). This plugin adds the question
 * index that rail cannot show on its own:
 *
 *  - a small expand control pinned to the bottom of the rail;
 *  - a popover listing every question (the first human prompt of each Turn),
 *    fed by the `turnOutline` session projection;
 *  - click a question to jump to its Turn by driving the rail's own mark, so
 *    the official load-through / scroll / active-turn logic stays in charge.
 *
 * There is no Slot on the rail itself, so the rail DOM is the hand-off point:
 * the overlay finds the `<nav>` that owns `button[data-index]` marks, measures
 * it, and renders its controls into the frame-wide `shell.overlay` seat (the
 * floating layer above every column, sharing the active light/dark palette).
 */

window.__ModuleLoader__.load({
  id: 'dsh-turn-index',
  factory: (require) => {
    const exports = {}
    const React = require('react')
    const { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } = React

    /** Locale namespace owned by this plugin. */
    const NS = 'turnIndex'
    /** Marker attribute on the injected stylesheet. */
    const STYLE_ATTR = 'data-dsh-turn-index-style'
    /** Stable marker attribute on the expand control. */
    const BUTTON_ATTR = 'data-dsh-turn-index-button'
    /** Stable marker attribute on the popover. */
    const PANEL_ATTR = 'data-dsh-turn-index-panel'

    const zh = {
      title: '提问索引',
      expand: '展开提问索引',
      collapse: '收起提问索引',
      turn: '第 {turn} 轮',
      empty: '还没有提问',
      noMatch: '没有匹配的提问',
      search: '搜索提问…',
      searchLabel: '搜索提问',
      clearSearch: '清除搜索',
      close: '收起',
    }

    const en = {
      title: 'Question index',
      expand: 'Expand question index',
      collapse: 'Collapse question index',
      turn: 'Turn {turn}',
      empty: 'No questions yet',
      noMatch: 'No matching questions',
      search: 'Filter questions…',
      searchLabel: 'Search questions',
      clearSearch: 'Clear search',
      close: 'Collapse',
    }

    const CSS = `
.dsh-turn-index-button {
  position: fixed;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l4, rgba(0, 0, 0, .16));
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-1, #fff);
  color: var(--dsw-alias-label-tertiary, #666);
  box-shadow: var(--dsw-elevation-panel, 0 2px 8px rgba(0, 0, 0, .12));
  cursor: pointer;
  pointer-events: auto;
  transition: color .14s ease, background-color .14s ease, border-color .14s ease;
}
.dsh-turn-index-button:hover,
.dsh-turn-index-button[data-open="true"] {
  color: var(--dsw-alias-label-primary, #111);
  background: var(--dsw-alias-bg-layer-2, #f5f5f5);
  border-color: var(--dsw-alias-border-l3, rgba(0, 0, 0, .24));
}
.dsh-turn-index-button:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: 2px;
}
.dsh-turn-index-panel {
  position: fixed;
  z-index: 61;
  display: flex;
  flex-direction: column;
  min-height: 140px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
  border-radius: var(--dsw-radius-lg, 14px);
  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-1, #fff));
  color: var(--dsw-alias-label-primary, #111);
  box-shadow: var(--dsw-elevation-panel, 0 12px 32px rgba(0, 0, 0, .18));
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(20px));
  pointer-events: auto;
  animation: dsh-turn-index-in 140ms cubic-bezier(.2, .8, .2, 1);
  transform-origin: bottom right;
}
.dsh-turn-index-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
  padding: 8px 8px 8px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
}
.dsh-turn-index-heading {
  display: flex;
  flex: none;
  min-width: 0;
  align-items: center;
  gap: 6px;
}
.dsh-turn-index-title {
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #111);
  font: var(--dsw-font-xs-strong-13, 500 13px/20px system-ui, sans-serif);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-turn-index-count {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #f5f5f5);
  color: var(--dsw-alias-label-tertiary, #666);
  font: var(--dsw-font-xxxs-strong-11, 500 11px/14px system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
}
.dsh-turn-index-close {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #666);
  cursor: pointer;
}
.dsh-turn-index-close:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
  color: var(--dsw-alias-label-primary, #111);
}
.dsh-turn-index-close:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: -2px;
}
.dsh-turn-index-search {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  box-sizing: border-box;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
  border-radius: 6px;
  background: var(--dsw-alias-bg-layer-2, #f5f5f5);
  color: var(--dsw-alias-label-tertiary, #666);
}
.dsh-turn-index-search:focus-within {
  border-color: var(--dsw-alias-border-l3, rgba(0, 0, 0, .2));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 16%, transparent);
}
.dsh-turn-index-search-icon {
  flex: none;
  opacity: .85;
}
.dsh-turn-index-search input[type="search"] {
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--dsw-alias-label-primary, #111);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
}
.dsh-turn-index-search input[type="search"]::placeholder {
  color: var(--dsw-alias-label-caption, #999);
}
.dsh-turn-index-search input[type="search"]::-webkit-search-cancel-button {
  display: none;
}
.dsh-turn-index-search-clear {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary, #666);
  cursor: pointer;
}
.dsh-turn-index-search-clear:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
  color: var(--dsw-alias-label-primary, #111);
}
.dsh-turn-index-search-clear:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: -1px;
}
.dsh-turn-index-list {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 1px;
  min-height: 0;
  padding: 6px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.dsh-turn-index-row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
  width: 100%;
  padding: 7px 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.dsh-turn-index-row:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
}
.dsh-turn-index-row[data-active="true"] {
  background: var(--dsw-alias-interactive-bg-hover-accent, rgba(0, 0, 0, .09));
  box-shadow: inset 2px 0 0 var(--dsw-alias-state-business-primary, #4d6bfe);
}
.dsh-turn-index-row:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: -2px;
}
.dsh-turn-index-num {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  margin-top: 1px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
  border-radius: 5px;
  background: var(--dsw-alias-bg-layer-2, #f5f5f5);
  color: var(--dsw-alias-label-tertiary, #666);
  font: var(--dsw-font-xxxs-strong-11, 500 11px/14px system-ui, sans-serif);
  font-variant-numeric: tabular-nums;
}
.dsh-turn-index-prompt {
  display: -webkit-box;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #111);
  font: var(--dsw-font-xs-13, 13px/20px system-ui, sans-serif);
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}
.dsh-turn-index-empty {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 14px;
  color: var(--dsw-alias-label-caption, #999);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
  text-align: center;
}
.dsh-turn-index-empty-action {
  padding: 3px 9px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .08));
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #666);
  font: var(--dsw-font-xxs-12, 12px/18px system-ui, sans-serif);
  cursor: pointer;
}
.dsh-turn-index-empty-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
  color: var(--dsw-alias-label-primary, #111);
}
@keyframes dsh-turn-index-in {
  from { opacity: 0; transform: translateX(6px) scale(.985); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .dsh-turn-index-button { transition: none; }
  .dsh-turn-index-panel { animation: none; }
}
`

    /** Install the stylesheet once per page. */
    function ensureStyle() {
      if (typeof document === 'undefined') return
      if (document.querySelector(`style[${STYLE_ATTR}]`) !== null) return
      const style = document.createElement('style')
      style.setAttribute(STYLE_ATTR, '')
      style.textContent = CSS
      document.head.appendChild(style)
    }

    /** Remove the plugin's stylesheet (plugin unload). */
    function removeStyle() {
      if (typeof document === 'undefined') return
      for (const node of document.querySelectorAll(`style[${STYLE_ATTR}]`)) node.remove()
    }

    /** Whether an element is actually laid out (container queries can hide the rail). */
    function isVisible(element) {
      if (element === null || !element.isConnected) return false
      const style = window.getComputedStyle(element)
      if (style.display === 'none' || style.visibility === 'hidden') return false
      return element.getClientRects().length > 0
    }

    /**
     * Find the live turn rail. It is the only `<nav>` in the app whose marks are
     * `button[data-index]`, so no locale-dependent accessible name is needed.
     * When several conversation occurrences exist (main + right sidebar chat),
     * the first visible one wins.
     */
    function findRail() {
      for (const nav of document.querySelectorAll('nav')) {
        if (nav.querySelector('button[data-index]') === null) continue
        if (!isVisible(nav)) continue
        return nav
      }
      return null
    }

    function sameRect(left, right) {
      if (left === right) return true
      if (left === null || right === null) return false
      return (
        Math.abs(left.left - right.left) < 0.5 &&
        Math.abs(left.top - right.top) < 0.5 &&
        Math.abs(left.width - right.width) < 0.5 &&
        Math.abs(left.height - right.height) < 0.5
      )
    }

    /** Track the rail element as the conversation mounts, switches view, or resizes. */
    function useRail() {
      const [rail, setRail] = useState(null)
      useEffect(() => {
        let timer = 0
        let current = null
        const scan = () => {
          const next = findRail()
          if (next === current) return
          current = next
          setRail(next)
        }
        scan()
        timer = window.setInterval(scan, 400)
        window.addEventListener('resize', scan)
        return () => {
          window.clearInterval(timer)
          window.removeEventListener('resize', scan)
        }
      }, [])
      return rail
    }

    /**
     * Read the `turnOutline` projection of the current Session. The projection is
     * the whole-log outline: every Turn, its `turn/start` seq, and bounded prompt
     * and response previews, including Turns whose events are not paged in yet.
     *
     * The selected Session lives on the UI-session binding source
     * (`uiSession.current.key`), not on the session-list snapshot, so both are
     * watched: `current` moves on navigation, the list retries a binding that was
     * not materialized yet.
     */
    function useTurnOutline(sessions, uiSession) {
      const [turns, setTurns] = useState([])
      const [sessionId, setSessionId] = useState(undefined)
      useEffect(() => {
        let disposed = false
        let offFace = null
        let offList = null
        let offCurrent = null
        let face = null
        let currentId = Symbol('initial')
        const currentSource = uiSession.current

        const readCurrentId = () => {
          const current = currentSource.getSnapshot()
          return current === undefined ? undefined : current.key
        }

        const publish = () => {
          if (disposed) return
          const value = face === null ? undefined : face.getSnapshot()
          setTurns(Array.isArray(value) ? value : [])
        }

        const attach = () => {
          const id = readCurrentId()
          if (id === currentId && (face !== null || id === undefined)) return
          if (id !== currentId) {
            currentId = id
            if (offFace !== null) {
              offFace()
              offFace = null
            }
            face = null
            setTurns([])
            setSessionId(id)
            if (id === undefined) return
          }
          let binding
          try {
            binding = sessions.binding(id)
          } catch {
            binding = undefined
          }
          if (binding === undefined) {
            setTurns([])
            return
          }
          try {
            face = binding.session.projections.faceOf('turnOutline')
          } catch {
            face = null
            setTurns([])
            return
          }
          publish()
          offFace = face.subscribe(publish)
        }

        attach()
        offCurrent = currentSource.subscribe(attach)
        offList = sessions.list.subscribe(attach)
        return () => {
          disposed = true
          if (offCurrent !== null) offCurrent()
          if (offList !== null) offList()
          if (offFace !== null) offFace()
        }
      }, [sessions, uiSession])
      return { turns, sessionId }
    }

    /** Measure the rail; re-measure on resize and while the popover is open. */
    function useRailRect(rail, active) {
      const [rect, setRect] = useState(null)
      useLayoutEffect(() => {
        if (rail === null) {
          setRect(null)
          return
        }
        let raf = 0
        const read = () => {
          raf = 0
          if (!rail.isConnected) {
            setRect(null)
            return
          }
          const box = rail.getBoundingClientRect()
          if (box.width === 0 && box.height === 0) {
            setRect(null)
            return
          }
          const next = {
            left: box.left,
            top: box.top,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          }
          setRect((previous) => (sameRect(previous, next) ? previous : next))
        }
        const schedule = () => {
          if (raf === 0) raf = requestAnimationFrame(read)
        }
        read()
        let observer = null
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(schedule)
          observer.observe(rail)
        }
        window.addEventListener('resize', schedule)
        const timer = window.setInterval(schedule, active ? 250 : 1000)
        return () => {
          if (observer !== null) observer.disconnect()
          window.removeEventListener('resize', schedule)
          window.clearInterval(timer)
          if (raf !== 0) cancelAnimationFrame(raf)
        }
      }, [rail, active])
      return rect
    }

    /** Follow the rail's own active mark so the index highlights the Turn in view. */
    function useActiveIndex(rail, turns) {
      const [activeIndex, setActiveIndex] = useState(null)
      useEffect(() => {
        if (rail === null) {
          setActiveIndex(null)
          return
        }
        const read = () => {
          const mark = rail.querySelector('button[data-index][aria-current="true"]')
          if (mark === null) {
            setActiveIndex(null)
            return
          }
          const index = Number(mark.getAttribute('data-index'))
          setActiveIndex(Number.isInteger(index) && index >= 0 && index < turns.length ? index : null)
        }
        read()
        const observer = new MutationObserver(read)
        observer.observe(rail, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-current', 'data-index'],
        })
        return () => observer.disconnect()
      }, [rail, turns])
      return activeIndex
    }

    function Chevron({ open }) {
      return React.createElement(
        'svg',
        {
          width: 14,
          height: 14,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        React.createElement('path', { d: open ? 'm9 18 6-6-6-6' : 'm15 18-6-6 6-6' }),
      )
    }

    function SearchIcon() {
      return React.createElement(
        'svg',
        {
          className: 'dsh-turn-index-search-icon',
          width: 11,
          height: 11,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        React.createElement('circle', { cx: 11, cy: 11, r: 7 }),
        React.createElement('path', { d: 'm20 20-3.2-3.2' }),
      )
    }

    function ClearIcon() {
      return React.createElement(
        'svg',
        {
          width: 9,
          height: 9,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 2.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        React.createElement('path', { d: 'M6 6l12 12M18 6 6 18' }),
      )
    }

    /** One question row. */
    function QuestionRow({ index, item, active, t, onJump, register }) {
      const prompt = item.prompt === '' ? t('turn', { turn: item.turn }) : item.prompt
      return React.createElement(
        'button',
        {
          ref: register,
          type: 'button',
          className: 'dsh-turn-index-row',
          'data-active': active ? 'true' : undefined,
          'aria-current': active ? 'true' : undefined,
          title: prompt,
          onClick: () => onJump(index),
        },
        React.createElement('span', { className: 'dsh-turn-index-num', 'aria-hidden': 'true' }, String(item.turn)),
        React.createElement('span', { className: 'dsh-turn-index-prompt' }, prompt),
      )
    }

    /**
     * The frame-wide overlay: an expand control pinned under the turn rail and
     * the question-index popover it opens.
     */
    function TurnIndexOverlay({ sessions, uiSession, locale, t }) {
      const rail = useRail()
      const { turns, sessionId } = useTurnOutline(sessions, uiSession)
      const [open, setOpen] = useState(false)
      const [query, setQuery] = useState('')
      const [panelHeight, setPanelHeight] = useState(0)
      const [lockedHeight, setLockedHeight] = useState(null)
      const [, forceLocale] = useState(0)
      const rect = useRailRect(rail, open)
      const activeIndex = useActiveIndex(rail, turns)
      const panelId = useId()
      const buttonRef = useRef(null)
      const panelRef = useRef(null)
      const searchRef = useRef(null)
      const listRef = useRef(null)
      const rowsRef = useRef(new Map())
      const lastStableHeightRef = useRef(0)
      const wasSearchingRef = useRef(false)

      const needle = query.trim().toLowerCase()
      const filtered = useMemo(() => {
        if (needle === '') return turns.map((item, index) => ({ item, index }))
        return turns.flatMap((item, index) => {
          const prompt = typeof item.prompt === 'string' ? item.prompt : ''
          const haystack = `${String(item.turn)} ${prompt}`.toLowerCase()
          return haystack.includes(needle) ? [{ item, index }] : []
        })
      }, [turns, needle])

      // Locale switching re-renders through the live `t` binding.
      useEffect(() => {
        if (locale === undefined || locale === null || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => forceLocale((value) => value + 1))
      }, [locale])

      // A different Session starts with the index closed (not the first attach).
      const lastSessionRef = useRef(sessionId)
      useEffect(() => {
        if (lastSessionRef.current !== undefined && lastSessionRef.current !== sessionId) setOpen(false)
        lastSessionRef.current = sessionId
      }, [sessionId])

      useEffect(() => {
        if (rail === null || turns.length < 2) setOpen(false)
      }, [rail, turns.length])

      // A closed popover starts clean; typing after reopening begins at the top.
      useEffect(() => {
        if (!open) {
          setQuery('')
          return
        }
        if (listRef.current !== null) listRef.current.scrollTop = 0
      }, [open, needle])

      // Closing releases a search lock.
      useLayoutEffect(() => {
        if (!open) {
          setLockedHeight(null)
          wasSearchingRef.current = false
        }
      }, [open])

      // Entering search freezes the height the full list had at that moment.
      // Every later query keeps that height; clearing it releases the lock so
      // the panel can size to content again.
      useLayoutEffect(() => {
        const searching = needle !== ''
        if (searching && !wasSearchingRef.current) {
          const stable = lastStableHeightRef.current
          if (stable > 0) setLockedHeight(stable)
        } else if (!searching && wasSearchingRef.current) {
          setLockedHeight(null)
        }
        wasSearchingRef.current = searching
      }, [needle])

      // Height is content-driven while not searching: the panel grows upward
      // from the rail, then downward, and only scrolls once it reaches the chat
      // bottom. Filtered renders are deliberately not measured — the locked
      // height owns that phase, so typing never moves the surface.
      useLayoutEffect(() => {
        if (!open) {
          setPanelHeight(0)
          lastStableHeightRef.current = 0
          return undefined
        }
        if (needle !== '') return undefined
        const element = panelRef.current
        if (element === null) return undefined
        const measure = () => {
          const height = element.getBoundingClientRect().height
          lastStableHeightRef.current = height
          setPanelHeight((previous) => (Math.abs(previous - height) < 0.5 ? previous : height))
        }
        measure()
        let observer = null
        if (typeof ResizeObserver !== 'undefined') {
          observer = new ResizeObserver(measure)
          observer.observe(element)
        }
        return () => {
          if (observer !== null) observer.disconnect()
        }
      }, [open, needle, filtered.length])

      const layout = useMemo(() => {
        if (rect === null) return null
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const buttonSize = 22
        let buttonTop = Math.round(rect.bottom + 6)
        if (buttonTop + buttonSize > viewportHeight - 8) {
          buttonTop = Math.max(8, Math.round(rect.top - buttonSize - 6))
        }
        const buttonLeft = Math.max(
          8,
          Math.min(viewportWidth - buttonSize - 8, Math.round(rect.left + rect.width / 2 - buttonSize / 2)),
        )
        const width = Math.max(
          240,
          Math.min(360, Math.round(rect.left - 28), Math.round(viewportWidth - 24)),
        )
        // Use the chat viewport, not the rail, as the vertical envelope: the
        // index should reach down to (but not over) the composer so a long
        // question list has as much room as the client can spare.
        const composerHeight =
          Number.parseFloat(window.getComputedStyle(rail).getPropertyValue('--dsh-composer-height')) || 160
        const safeBottom = viewportHeight - composerHeight - 8
        const frame = rail.parentElement === null ? null : rail.parentElement.parentElement
        const flow = frame === null ? null : frame.querySelector('[data-chat-flow]')
        const scroller = flow === null ? null : flow.parentElement
        const scrollBox = scroller === null ? null : scroller.getBoundingClientRect()
        const chatTop =
          scrollBox !== null && scrollBox.height > 120 ? Math.max(64, Math.round(scrollBox.top)) : 80
        const chatBottom =
          scrollBox !== null && scrollBox.height > 120 ? Math.min(Math.round(scrollBox.bottom), safeBottom) : safeBottom
        const topBoundary = chatTop + 8
        const bottomBoundary = chatBottom - 8
        const availableHeight = Math.max(160, Math.round(bottomBoundary - topBoundary))
        const maxHeight = availableHeight
        // Previous rule first: a short index keeps its bottom on the rail and
        // grows upward. Once it would cross the chat top, the bottom slides
        // toward the composer instead, until the full height is used and the
        // list scrolls. While searching, the pre-search height is the input so
        // the surface stays put.
        const availableAbove = Math.max(0, Math.round(rect.bottom - topBoundary))
        const positionHeight = lockedHeight !== null ? lockedHeight : panelHeight
        const measuredHeight = Math.min(positionHeight, maxHeight)
        const overflow = Math.max(0, measuredHeight - availableAbove)
        const bottomY = Math.min(bottomBoundary, Math.round(rect.bottom + overflow))
        const panelBottom = Math.max(12, Math.round(viewportHeight - bottomY))
        const right = Math.max(12, Math.round(viewportWidth - rect.left + 10))
        return { buttonTop, buttonLeft, width, panelBottom, maxHeight, right }
      }, [rail, rect, panelHeight, lockedHeight])

      const navigate = useCallback(
        async (index) => {
          const nav = rail
          if (nav === null || !nav.isConnected) return
          const clickMark = () => {
            const mark = nav.querySelector(`button[data-index="${index}"]`)
            if (mark === null) return false
            mark.click()
            return true
          }
          if (clickMark()) return
          const scroller = nav.firstElementChild
          if (!(scroller instanceof HTMLElement)) return
          const height = scroller.clientHeight
          if (height <= 0) return
          const center = index * 10
          const setOffset = (delta) => {
            const max = Math.max(0, scroller.scrollHeight - height)
            scroller.scrollTop = Math.max(0, Math.min(max, center - height / 2 + delta))
          }
          setOffset(0)
          // The rail virtualizes its marks; scroll it until the target mark is
          // rendered, then click that mark so load-through and settling logic
          // run exactly as a pointer click would.
          for (let attempt = 0; attempt < 8; attempt += 1) {
            await new Promise((resolve) => requestAnimationFrame(() => resolve()))
            if (clickMark()) return
            setOffset(attempt % 2 === 0 ? 14 : -14)
          }
          // Last resort: scroll a loaded turn row directly (no history paging).
          const turn = turns[index] === undefined ? undefined : turns[index].turn
          if (turn !== undefined) {
            const row = document.querySelector(`[data-chat-flow] [data-chat-turn="${turn}"]`)
            if (row instanceof HTMLElement) row.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        },
        [rail, turns],
      )

      // Open: focus the filter so typing filters immediately; keep the Turn in
      // view scrolled into place without stealing focus from the input.
      useEffect(() => {
        if (!open) return undefined
        if (searchRef.current !== null) searchRef.current.focus({ preventScroll: true })
        const preferred = activeIndex === null ? 0 : activeIndex
        const row = rowsRef.current.get(preferred) || rowsRef.current.get(0)
        if (row !== null && row !== undefined) row.scrollIntoView({ block: 'nearest' })
        return undefined
      }, [open])

      // Click-away and Escape close the popover.
      useEffect(() => {
        if (!open) return undefined
        const onPointerDown = (event) => {
          const target = event.target
          if (panelRef.current !== null && target instanceof Node && panelRef.current.contains(target)) return
          if (buttonRef.current !== null && target instanceof Node && buttonRef.current.contains(target)) return
          setOpen(false)
        }
        const onKeyDown = (event) => {
          if (event.key !== 'Escape') return
          setOpen(false)
          if (buttonRef.current !== null) buttonRef.current.focus()
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown)
        return () => {
          document.removeEventListener('pointerdown', onPointerDown, true)
          document.removeEventListener('keydown', onKeyDown)
        }
      }, [open])

      const visible = rail !== null && turns.length >= 2 && rect !== null && layout !== null
      if (!visible) return null

      const buttonLabel = open ? t('collapse') : t('expand')
      const button = React.createElement(
        'button',
        {
          ref: buttonRef,
          type: 'button',
          [BUTTON_ATTR]: '',
          className: 'dsh-turn-index-button',
          style: { left: layout.buttonLeft, top: layout.buttonTop },
          'data-open': open ? 'true' : 'false',
          'aria-label': buttonLabel,
          'aria-expanded': open,
          'aria-controls': panelId,
          'aria-haspopup': 'dialog',
          title: buttonLabel,
          onClick: () => setOpen((value) => !value),
        },
        React.createElement(Chevron, { open }),
      )

      const panel = !open
        ? null
        : React.createElement(
            'section',
            {
              ref: panelRef,
              id: panelId,
              [PANEL_ATTR]: '',
              className: 'dsh-turn-index-panel',
              role: 'dialog',
              'aria-modal': 'false',
              'aria-label': t('title'),
              tabIndex: -1,
              style: {
                right: layout.right,
                bottom: layout.panelBottom,
                width: layout.width,
                height: lockedHeight !== null ? Math.min(lockedHeight, layout.maxHeight) : undefined,
                maxHeight: layout.maxHeight,
              },
            },
            React.createElement(
              'header',
              { className: 'dsh-turn-index-head' },
              React.createElement(
                'div',
                { className: 'dsh-turn-index-heading' },
                React.createElement('span', { className: 'dsh-turn-index-title' }, t('title')),
                React.createElement(
                  'span',
                  { className: 'dsh-turn-index-count' },
                  String(filtered.length),
                ),
              ),
              React.createElement(
                'div',
                { className: 'dsh-turn-index-search' },
                React.createElement(SearchIcon),
                React.createElement('input', {
                  ref: searchRef,
                  type: 'search',
                  value: query,
                  placeholder: t('search'),
                  'aria-label': t('searchLabel'),
                  autoComplete: 'off',
                  spellCheck: false,
                  onChange: (event) => setQuery(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      if (query !== '') {
                        event.preventDefault()
                        event.stopPropagation()
                        setQuery('')
                      }
                      return
                    }
                    if (event.key === 'Enter') {
                      if (needle === '' || filtered.length === 0) return
                      event.preventDefault()
                      void navigate(filtered[0].index)
                      return
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      const first =
                        listRef.current === null ? null : listRef.current.querySelector('button.dsh-turn-index-row')
                      if (first !== null) first.focus()
                    }
                  },
                }),
                query !== '' &&
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      className: 'dsh-turn-index-search-clear',
                      'aria-label': t('clearSearch'),
                      title: t('clearSearch'),
                      onClick: () => {
                        setQuery('')
                        if (searchRef.current !== null) searchRef.current.focus()
                      },
                    },
                    React.createElement(ClearIcon),
                  ),
              ),
              React.createElement(
                'button',
                {
                  type: 'button',
                  className: 'dsh-turn-index-close',
                  'aria-label': t('close'),
                  title: t('close'),
                  onClick: () => {
                    setOpen(false)
                    if (buttonRef.current !== null) buttonRef.current.focus()
                  },
                },
                React.createElement(Chevron, { open: true }),
              ),
            ),
            React.createElement(
              'div',
              { ref: listRef, className: 'dsh-turn-index-list' },
              turns.length === 0
                ? React.createElement('div', { className: 'dsh-turn-index-empty' }, t('empty'))
                : filtered.length === 0
                  ? React.createElement(
                      'div',
                      { className: 'dsh-turn-index-empty' },
                      React.createElement('span', null, t('noMatch')),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-turn-index-empty-action',
                          onClick: () => {
                            setQuery('')
                            if (searchRef.current !== null) searchRef.current.focus()
                          },
                        },
                        t('clearSearch'),
                      ),
                    )
                  : filtered.map(({ item, index }) =>
                      React.createElement(QuestionRow, {
                        key: item.turn === undefined ? index : item.turn,
                        index,
                        item,
                        active: index === activeIndex,
                        t,
                        onJump: (target) => {
                          void navigate(target)
                        },
                        register: (element) => {
                          if (element === null) rowsRef.current.delete(index)
                          else rowsRef.current.set(index, element)
                        },
                      }),
                    ),
            ),
          )

      return React.createElement(React.Fragment, null, button, panel)
    }

    /** Shows a plugin error instead of unmounting the whole overlay seat. */
    class OverlayBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { error: null }
      }
      static getDerivedStateFromError(error) {
        return { error }
      }
      componentDidCatch(error) {
        if (typeof console !== 'undefined') console.error('dsh-turn-index:', error)
      }
      render() {
        if (this.state.error !== null) {
          return React.createElement(
            'div',
            {
              style: {
                position: 'fixed',
                top: 8,
                left: 8,
                zIndex: 9999,
                padding: '4px 8px',
                borderRadius: 4,
                background: '#c00',
                color: '#fff',
                font: '12px monospace',
              },
            },
            `turn-index error: ${String(this.state.error && this.state.error.message)}`,
          )
        }
        return this.props.children
      }
    }

    /** Client plugin body. */
    function apply(ctx) {
      ctx.effect(() => {
        ensureStyle()
        return () => removeStyle()
      }, 'dsh-turn-index: styles')
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-turn-index: dictionaries')
      const t = ctx.locale.bind(NS)
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register(
          {
            name: 'shell.overlay',
            id: 'turn-index',
            order: 60,
            locale: NS,
          },
          () =>
            React.createElement(
              OverlayBoundary,
              null,
              React.createElement(TurnIndexOverlay, {
                sessions: ctx.sessions,
                uiSession: ctx.uiSession,
                locale: ctx.locale,
                t,
              }),
            ),
        ),
      )
    }

    exports.name = 'dsh-turn-index'
    exports.inject = ['slots', 'sessions', 'uiSession', 'locale']
    exports.apply = apply
    return exports
  },
})



