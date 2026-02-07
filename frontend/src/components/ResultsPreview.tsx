import { useState, useMemo } from 'react'
import { FileSpreadsheet, Search } from 'lucide-react'
import { Card, CardHeader, CardTitle } from './ui/Card'
import { Badge } from './ui/Badge'
import { Spinner } from './ui/Spinner'
import { cn } from '../lib/utils'

interface ResultsPreviewProps {
  columns: string[]
  data: Record<string, unknown>[]
  rowCount: number
  isLoading?: boolean
}

export function ResultsPreview({
  columns,
  data,
  rowCount,
  isLoading = false,
}: ResultsPreviewProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) {
      return data
    }

    const query = searchQuery.toLowerCase()
    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value ?? '').toLowerCase().includes(query)
      )
    )
  }, [data, searchQuery])

  const matchCount = filteredData.length
  const hasSearch = searchQuery.trim().length > 0

  return (
    <Card padding="none">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between w-full">
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Results
            <Badge variant="default" className="ml-2">
              {rowCount} rows × {columns.length} columns
            </Badge>
          </CardTitle>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search results..."
                className={cn(
                  'pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
                  'transition-all duration-200 w-64'
                )}
              />
            </div>
            {hasSearch && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {matchCount} of {rowCount} rows
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <div className="overflow-auto max-h-[70vh] w-full">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : filteredData.length === 0 && hasSearch ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            No rows match your search
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="sticky left-0 z-[5] bg-slate-50 border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-400 text-xs font-mono whitespace-nowrap">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-left font-medium text-slate-700 whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={cn(
                    'border-b border-slate-100',
                    rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                  )}
                >
                  <td className="sticky left-0 z-[5] bg-inherit border-r border-slate-200 px-3 py-2 text-slate-400 text-xs font-mono whitespace-nowrap">
                    {rowIdx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2 text-slate-600 whitespace-nowrap max-w-[200px] truncate"
                      title={String(row[col] ?? '')}
                    >
                      {row[col] != null ? String(row[col]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  )
}
