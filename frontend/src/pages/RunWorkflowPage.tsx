import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, FileSpreadsheet, FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { Badge } from '../components/ui/Badge'
import { FileUploadZone } from '../components/FileUpload/FileUploadZone'
import { DiffPreview } from '../components/DiffPreview/DiffPreview'
import { workflowApi, runApi } from '../lib/api'
import type { RunPreview, Run } from '../types'

type Stage = 'upload' | 'preview' | 'complete'

export function RunWorkflowPage() {
  const { id: workflowId } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>('upload')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [targetFile, setTargetFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [runPreview, setRunPreview] = useState<RunPreview | null>(null)
  const [completedRun, setCompletedRun] = useState<Run | null>(null)

  const { data: workflow, isLoading: workflowLoading } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowApi.get(workflowId!),
    enabled: !!workflowId,
  })

  const handleRunPreview = async () => {
    if (!sourceFile || !targetFile || !workflowId) return

    setLoading(true)
    setError(null)

    try {
      const preview = await runApi.preview(workflowId, sourceFile, targetFile)
      setRunPreview(preview)
      setStage('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview run')
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!runPreview) return

    setLoading(true)
    setError(null)

    try {
      const run = await runApi.execute(runPreview.runId, true)
      setCompletedRun(run)
      setStage('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute run')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setStage('upload')
    setRunPreview(null)
    setError(null)
  }

  const handleDownload = (type: 'excel' | 'pdf') => {
    if (!completedRun) return
    window.open(runApi.downloadUrl(completedRun.id, type), '_blank')
  }

  if (workflowLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate('/workflows')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            Run Workflow
          </h1>
          {workflow && (
            <p className="text-slate-500">
              {workflow.name}
              <Badge className="ml-2">
                Key: {workflow.sourceConfig?.keyColumn}
              </Badge>
            </p>
          )}
        </div>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200">
          <p className="text-red-700">{error}</p>
        </Card>
      )}

      {/* Upload stage */}
      {stage === 'upload' && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Source File</CardTitle>
              </CardHeader>
              <p className="text-sm text-slate-500 mb-4">
                The file containing data to match (e.g., sales records)
              </p>
              <FileUploadZone
                onFileSelect={setSourceFile}
                selectedFile={sourceFile}
                onClear={() => setSourceFile(null)}
                label="Drop source file here"
              />
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Target File</CardTitle>
              </CardHeader>
              <p className="text-sm text-slate-500 mb-4">
                The file to update (e.g., inventory)
              </p>
              <FileUploadZone
                onFileSelect={setTargetFile}
                selectedFile={targetFile}
                onClear={() => setTargetFile(null)}
                label="Drop target file here"
              />
            </Card>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleRunPreview}
              disabled={!sourceFile || !targetFile || loading}
            >
              {loading ? (
                <>
                  <Spinner size="sm" className="text-white" />
                  Processing...
                </>
              ) : (
                'Preview Changes'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Preview stage */}
      {stage === 'preview' && runPreview && (
        <DiffPreview
          diff={runPreview.diff}
          onApprove={handleApprove}
          onCancel={handleCancel}
          approving={loading}
        />
      )}

      {/* Complete stage */}
      {stage === 'complete' && completedRun && (
        <Card className="text-center py-12">
          <div className="flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mx-auto mb-4">
            <FileSpreadsheet className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            Workflow Complete!
          </h2>
          <p className="text-slate-500 mb-6">
            Your output files are ready for download.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Button onClick={() => handleDownload('excel')}>
              <Download className="w-4 h-4" />
              Download Excel
            </Button>
            {completedRun.outputPdf && (
              <Button variant="secondary" onClick={() => handleDownload('pdf')}>
                <FileText className="w-4 h-4" />
                Download PDF Summary
              </Button>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <Button
              variant="ghost"
              onClick={() => {
                setStage('upload')
                setSourceFile(null)
                setTargetFile(null)
                setRunPreview(null)
                setCompletedRun(null)
              }}
            >
              Run Again
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
