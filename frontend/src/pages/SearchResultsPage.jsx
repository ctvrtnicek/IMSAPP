import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { globalSearch } from '../api/search.js'

const TYPE_ICONS = {
  'Terminal':              '▦',
  'Purchase Order':        '↓',
  'Sales Order':           '↑',
  'Rental Order':          '↑',
  'Replacement Order':     '↑',
  'Distribution Order':    '⇆',
  'Repair & Rework Order': '⚒',
  'Return Order':          '↩',
  'Product':               '⬡',
  'Customer':              '👤',
  'Supplier':              '🏭',
}

const TYPE_COLORS = {
  'Terminal':              '#1A6B7B',
  'Purchase Order':        '#2563eb',
  'Sales Order':           '#16a34a',
  'Rental Order':          '#7c3aed',
  'Replacement Order':     '#d97706',
  'Distribution Order':    '#0891b2',
  'Repair & Rework Order': '#dc2626',
  'Return Order':          '#9333ea',
  'Product':               '#64748b',
  'Customer':              '#0f766e',
  'Supplier':              '#92400e',
}

function ResultRow({ result, navigate }) {
  const icon  = TYPE_ICONS[result.object_type] || '○'
  const color = TYPE_COLORS[result.object_type] || '#6b7280'

  function handleClick() {
    const path = result.url_path
    if (path && path !== '/dashboard') {
      navigate(path)
    }
  }

  return (
    <div
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '10px 16px', borderBottom: '1px solid #f3f4f6',
        cursor: result.url_path && result.url_path !== '/dashboard' ? 'pointer' : 'default',
        transition: 'background 0.1s',
      }}
      onMouseOver={e => { if (result.url_path && result.url_path !== '/dashboard') e.currentTarget.style.background = '#f9fafb' }}
      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{ fontSize: 18, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color, background: `${color}18`, borderRadius: 4, padding: '2px 7px', flexShrink: 0 }}>
            {result.object_type}
          </span>
          <span style={{ fontWeight: 600, color: '#1f2937', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.identifier}
          </span>
        </div>
        {result.description && (
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {result.description}
          </p>
        )}
      </div>
      {result.url_path && result.url_path !== '/dashboard' && (
        <span style={{ fontSize: 13, color: '#9ca3af', flexShrink: 0 }}>→</span>
      )}
    </div>
  )
}

function Section({ title, results, navigate }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ padding: '8px 16px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {title}
        </span>
        <span style={{ marginLeft: 8, fontSize: 12, color: '#9ca3af' }}>({results.length})</span>
      </div>
      {results.map((r, i) => (
        <ResultRow key={i} result={r} navigate={navigate} />
      ))}
    </div>
  )
}

export default function SearchResultsPage({ term, onNavigate, onClearSearch }) {
  const navigate = useNavigate()
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!term) return
    setLoading(true); setError(null); setResults(null)
    globalSearch(term)
      .then(res => setResults(res.data))
      .catch(err => setError(err?.response?.data?.detail || 'Search failed.'))
      .finally(() => setLoading(false))
  }, [term])

  const total = results ? (results.exact?.length || 0) + (results.partial?.length || 0) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1f2937' }}>
          Search results
          {term && <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: 8, fontSize: 17 }}>for "{term}"</span>}
        </h1>
        <button
          onClick={() => { onClearSearch?.(); onNavigate?.('dashboard') }}
          style={{ marginLeft: 'auto', fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', color: '#374151' }}
        >
          ← Back to Dashboard
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#9ca3af', fontSize: 14 }}>
          <span>Searching…</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#b91c1c', fontSize: 13 }}>
          {error}
        </div>
      )}

      {!loading && results && total === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          No results found for "{term}".
        </div>
      )}

      {!loading && results && total > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          {results.exact?.length > 0 && (
            <Section title="Exact Matches" results={results.exact} navigate={navigate} />
          )}
          {results.partial?.length > 0 && (
            <Section title="Partial Matches" results={results.partial} navigate={navigate} />
          )}
        </div>
      )}
    </div>
  )
}
