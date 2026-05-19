/**
 * MasterDataTable — generic reusable table for master data pages.
 *
 * Props:
 *   columns       - [{key, label, render?}]
 *   rows          - array of data objects
 *   onEdit        - fn(row) — if provided, shows Edit button
 *   onDeactivate  - fn(row) — if provided, shows Deactivate button
 *   loading       - boolean
 *   emptyMessage  - string shown when no rows
 */
export default function MasterDataTable({
  columns = [],
  rows = [],
  onEdit,
  onDeactivate,
  loading = false,
  emptyMessage = 'No records found.',
}) {
  const hasActions = onEdit || onDeactivate

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading…
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
      <table className="min-w-full bg-white text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {col.label}
              </th>
            ))}
            {hasActions && (
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (hasActions ? 1 : 0)}
                className="px-4 py-8 text-center text-gray-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr
                key={row.id ?? idx}
                className="border-b border-gray-100 hover:bg-blue-50 transition-colors"
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-gray-700">
                    {col.key === 'active' ? (
                      <ActiveBadge value={row.active} />
                    ) : col.render ? (
                      col.render(row[col.key], row)
                    ) : (
                      row[col.key] ?? <span className="text-gray-300">—</span>
                    )}
                  </td>
                ))}
                {hasActions && (
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(row)}
                          className="text-xs px-3 py-1 rounded-md border font-medium transition hover:opacity-80"
                          style={{ color: '#0075C2', borderColor: '#0075C2' }}
                        >
                          Edit
                        </button>
                      )}
                      {onDeactivate && row.active !== 0 && (
                        <button
                          onClick={() => onDeactivate(row)}
                          className="text-xs px-3 py-1 rounded-md border border-red-300 text-red-600 font-medium transition hover:bg-red-50"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function ActiveBadge({ value }) {
  const isActive = value === 1 || value === true
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
        isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
