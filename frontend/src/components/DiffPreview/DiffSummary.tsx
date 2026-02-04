import { CheckCircle, AlertTriangle, XCircle, FileSpreadsheet } from 'lucide-react'
import { Card } from '../ui/Card'
import type { DiffSummary as DiffSummaryType } from '../../types'

interface DiffSummaryProps {
  summary: DiffSummaryType
}

export function DiffSummary({ summary }: DiffSummaryProps) {
  return (
    <Card className="grid grid-cols-4 gap-4 p-0 overflow-hidden">
      {/* Rows affected */}
      <div className="flex items-center gap-4 p-5 border-r border-slate-100">
        <div className="flex items-center justify-center w-12 h-12 bg-primary-50 rounded-xl">
          <FileSpreadsheet className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.rowsAffected}
          </p>
          <p className="text-sm text-slate-500">Rows Affected</p>
        </div>
      </div>

      {/* Cells modified */}
      <div className="flex items-center gap-4 p-5 border-r border-slate-100">
        <div className="flex items-center justify-center w-12 h-12 bg-emerald-50 rounded-xl">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.cellsModified}
          </p>
          <p className="text-sm text-slate-500">Cells Modified</p>
        </div>
      </div>

      {/* Warnings */}
      <div className="flex items-center gap-4 p-5 border-r border-slate-100">
        <div className="flex items-center justify-center w-12 h-12 bg-amber-50 rounded-xl">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.warnings}
          </p>
          <p className="text-sm text-slate-500">Warnings</p>
        </div>
      </div>

      {/* Errors */}
      <div className="flex items-center gap-4 p-5">
        <div className="flex items-center justify-center w-12 h-12 bg-red-50 rounded-xl">
          <XCircle className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <p className="text-2xl font-semibold text-slate-900">
            {summary.errors}
          </p>
          <p className="text-sm text-slate-500">Errors</p>
        </div>
      </div>
    </Card>
  )
}
