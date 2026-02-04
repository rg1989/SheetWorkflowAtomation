import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Play, Edit, Trash2, Workflow } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { workflowApi } from '../lib/api'
import { formatRelativeTime } from '../lib/utils'

export function WorkflowsPage() {
  const queryClient = useQueryClient()

  const { data: workflows, isLoading, error } = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowApi.list,
  })

  const deleteMutation = useMutation({
    mutationFn: workflowApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
  })

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete "${name}"?`)) {
      deleteMutation.mutate(id)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <p className="text-red-700">
          Failed to load workflows: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflows</h1>
          <p className="text-slate-500 mt-1">
            Create and manage your data transformation workflows
          </p>
        </div>
        <Link to="/workflows/new">
          <Button>
            <Plus className="w-4 h-4" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Workflow list */}
      {!workflows || workflows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Workflow className="w-6 h-6 text-slate-400" />}
            title="No workflows yet"
            description="Create your first workflow to start automating your Excel data transformations."
            action={
              <Link to="/workflows/new">
                <Button>
                  <Plus className="w-4 h-4" />
                  Create Workflow
                </Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card
              key={workflow.id}
              className="flex items-center justify-between hover:border-slate-300 transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-lg font-medium text-slate-900">
                    {workflow.name}
                  </h3>
                  <Badge>
                    {workflow.steps.length} step{workflow.steps.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                {workflow.description && (
                  <p className="text-sm text-slate-500 mb-2">
                    {workflow.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>Key: {workflow.sourceConfig?.keyColumn || 'Not set'}</span>
                  <span>Updated {formatRelativeTime(workflow.updatedAt)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link to={`/workflows/${workflow.id}/run`}>
                  <Button variant="secondary" size="sm">
                    <Play className="w-4 h-4" />
                    Run
                  </Button>
                </Link>
                <Link to={`/workflows/${workflow.id}`}>
                  <Button variant="ghost" size="sm">
                    <Edit className="w-4 h-4" />
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(workflow.id, workflow.name)}
                  disabled={deleteMutation.isPending}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
