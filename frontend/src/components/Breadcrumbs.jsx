import { useEffect, useState } from 'react'

// Breadcrumb trail across detail pages (order -> DS -> WO -> terminal ...), so a user can
// backtrack the chain of documents they followed. Kept in sessionStorage because the links
// between detail pages are full page loads.
//   * Each detail page renders <Breadcrumbs label="SO000029" path="/order/SO000029" />.
//   * Revisiting a page that is already in the trail cuts the trail back to it.
//   * A detail page opened inside the dashboard (from a list) starts a new trail, and the
//     dashboard clears it on load / menu change (clearBreadcrumbs).
const KEY = 'ims_breadcrumbs'
const MAX = 10

function read() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || '[]') } catch { return [] }
}

function write(trail) {
  try { sessionStorage.setItem(KEY, JSON.stringify(trail)) } catch { /* storage unavailable */ }
}

export function clearBreadcrumbs() {
  write([])
}

export default function Breadcrumbs({ label, path }) {
  const [trail, setTrail] = useState([])

  useEffect(() => {
    if (!label || !path) return
    // Deferred so the dashboard's own clear (a parent effect, which runs after this
    // child's effects) happens first
    const t = setTimeout(() => {
      let next = window.location.pathname.startsWith('/dashboard') ? [] : read()
      const i = next.findIndex((c) => c.path === path)
      next = i >= 0 ? next.slice(0, i + 1) : [...next, { label, path }].slice(-MAX)
      write(next)
      setTrail(next)
    }, 0)
    return () => clearTimeout(t)
  }, [label, path])

  if (trail.length < 2) return null

  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex items-center flex-wrap gap-1 text-xs text-gray-500">
      {trail.map((c, i) => (
        <span key={c.path} className="flex items-center gap-1">
          {i > 0 && <span className="text-gray-300">›</span>}
          {i < trail.length - 1 ? (
            <a href={c.path} className="underline font-mono hover:text-gray-800">{c.label}</a>
          ) : (
            <span className="font-mono font-semibold text-gray-800">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
