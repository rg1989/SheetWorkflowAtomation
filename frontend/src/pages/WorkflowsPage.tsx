import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Workflow } from 'lucide-react'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { Spinner } from '../components/ui/Spinner'
import { WorkflowCard } from '../components/WorkflowCard'
import { workflowApi } from '../lib/api'

export function WorkflowsPage() {
  const queryClient = useQueryClient()

  // Fetch workflows
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

  const hasNoWorkflows = !workflows || workflows.length === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Workflows</h1>
          <p className="text-slate-500 mt-1">
            Create and manage your data processing workflows
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
      {hasNoWorkflows ? (
        <Card>
          <EmptyState
            icon={<Workflow className="w-6 h-6 text-slate-400" />}
            title="No workflows yet"
            description="Create your first workflow to start automating your Excel data processing."
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
        <div className="grid gap-3">
          {workflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onDelete={() => handleDelete(workflow.id, workflow.name)}
              isDeleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
