import { useState } from 'react'
import { Filter, AlertTriangle } from 'lucide-react'
import { Card, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Select } from '../ui/Select'
import { DiffSummary } from './DiffSummary'
import { RowDiff } from './RowDiff'
import type { DiffResult } from '../../types'

interface DiffPreviewProps {
  diff: DiffResult
  onApprove: () => void
  onCancel: () => void
  approving?: boolean
}

type FilterType = 'all' | 'warnings' | 'modified'

export function DiffPreview({
  diff,
  onApprove,
  onCancel,
  approving = false,
}: DiffPreviewProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filteredChanges = diff.changes.filter((change) => {
    if (filter === 'warnings') return change.hasWarning
    return true
  })

  const filterOptions = [
    { value: 'all', label: `All Changes (${diff.changes.length})` },
    {
      value: 'warnings',
      label: `Warnings Only (${diff.changes.filter((c) => c.hasWarning).length})`,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <DiffSummary summary={diff.summary} />

      {/* Warnings list */}
      {diff.warnings.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-medium text-amber-900 mb-2">
                {diff.warnings.length} Warning{diff.warnings.length !== 1 ? 's' : ''}
              </h3>
              <ul className="space-y-1">
                {diff.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-amber-700">
                    {warning.message}
                    {warning.row !== undefined && (
                      <span className="text-amber-500"> (Row {warning.row + 1})</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Changes list */}
      <Card padding="none">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <CardTitle>Changes Detail</CardTitle>
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              options={filterOptions}
              className="w-48"
            />
          </div>
        </div>

        <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
          {filteredChanges.length === 0 ? (
            <p className="text-center text-slate-500 py-8">
              No changes match the current filter
            </p>
          ) : (
            filteredChanges.map((rowChange, idx) => (
              <RowDiff
                key={`${rowChange.keyValue}-${idx}`}
                rowChange={rowChange}
                keyColumn={diff.keyColumn}
              />
            ))
          )}
        </div>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center justify-between p-6 bg-white rounded-xl border border-slate-200 shadow-sm sticky bottom-4">
        <div className="text-sm text-slate-500">
          Review the changes above before approving
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={approving}>
            Cancel
          </Button>
          <Button onClick={onApprove} disabled={approving}>
            {approving ? 'Generating...' : 'Approve & Generate Output'}
          </Button>
        </div>
      </div>
    </div>
  )
}
