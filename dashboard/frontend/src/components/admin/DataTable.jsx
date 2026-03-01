import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { cn } from '../../utils/helpers'

export default function DataTable({
  columns,          // [{ key, label, render?, sortable?, className?, hidden? }]
  data,             // array of row objects
  searchable = true,
  searchKeys = [],  // keys to search across
  pageSize = 10,
  onRowClick,
  emptyMessage = 'No data found',
  exportable = false,
  onExport,
  actions,          // render function (row) => JSX
  className,
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [sortKey, setSortKey] = useState(null)
  const [sortDir, setSortDir] = useState('asc')

  const filteredData = useMemo(() => {
    let result = data || []
    if (search && searchKeys.length > 0) {
      const q = search.toLowerCase()
      result = result.filter(row =>
        searchKeys.some(key => {
          const val = row[key]
          return val && String(val).toLowerCase().includes(q)
        })
      )
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = a[sortKey] ?? ''
        const vb = b[sortKey] ?? ''
        if (typeof va === 'number' && typeof vb === 'number') {
          return sortDir === 'asc' ? va - vb : vb - va
        }
        return sortDir === 'asc'
          ? String(va).localeCompare(String(vb))
          : String(vb).localeCompare(String(va))
      })
    }
    return result
  }, [data, search, searchKeys, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize)

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const visibleColumns = columns.filter(c => !c.hidden)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      {(searchable || exportable) && (
        <div className="flex items-center justify-between gap-4">
          {searchable && (
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-steel-500" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] text-steel-50 rounded-xl border border-white/[0.08] outline-none text-sm focus:ring-2 focus:ring-violet-500/30 placeholder-steel-600 transition-all"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <span className="text-xs text-steel-500 font-mono">{filteredData.length} items</span>
            {exportable && onExport && (
              <button
                onClick={onExport}
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {visibleColumns.map(col => (
                  <th
                    key={col.key}
                    className={cn(
                      'text-left px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider font-mono',
                      col.sortable && 'cursor-pointer hover:text-steel-300 transition-colors select-none',
                      col.className
                    )}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && sortKey === col.key && (
                        sortDir === 'asc'
                          ? <ChevronUp className="w-3 h-3" />
                          : <ChevronDown className="w-3 h-3" />
                      )}
                    </span>
                  </th>
                ))}
                {actions && (
                  <th className="text-right px-5 py-3 text-[10px] font-semibold text-steel-500 uppercase tracking-wider font-mono">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {pagedData.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  className={cn(
                    'border-b border-white/[0.04] transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  )}
                  onClick={() => onRowClick?.(row)}
                >
                  {visibleColumns.map(col => (
                    <td key={col.key} className={cn('px-5 py-3.5', col.className)}>
                      {col.render ? col.render(row) : (
                        <span className="text-sm text-steel-200">{row[col.key] ?? '—'}</span>
                      )}
                    </td>
                  ))}
                  {actions && (
                    <td className="px-5 py-3.5 text-right">
                      {actions(row)}
                    </td>
                  )}
                </tr>
              ))}
              {pagedData.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length + (actions ? 1 : 0)} className="text-center py-12 text-steel-500 text-sm">
                    {emptyMessage}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-steel-500 font-mono">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg text-steel-400 hover:text-steel-50 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i
              } else if (page < 3) {
                pageNum = i
              } else if (page > totalPages - 4) {
                pageNum = totalPages - 5 + i
              } else {
                pageNum = page - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-8 h-8 rounded-lg text-xs font-bold font-mono transition-colors',
                    page === pageNum
                      ? 'bg-violet-500/15 text-violet-400 border border-violet-500/25'
                      : 'text-steel-500 hover:text-steel-300 hover:bg-white/[0.06]'
                  )}
                >
                  {pageNum + 1}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg text-steel-400 hover:text-steel-50 hover:bg-white/[0.06] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
