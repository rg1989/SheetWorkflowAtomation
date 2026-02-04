import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { WorkflowEditor } from '../components/WorkflowEditor/WorkflowEditor'
import { Spinner } from '../components/ui/Spinner'
import { Card } from '../components/ui/Card'
import { workflowApi } from '../lib/api'

export function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  const { data: workflow, isLoading, error } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowApi.get(id!),
    enabled: !isNew,
  })

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!isNew && error) {
    return (
      <Card className="bg-red-50 border-red-200">
        <p className="text-red-700">
          Failed to load workflow: {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </Card>
    )
  }

  return <WorkflowEditor workflow={workflow} isNew={isNew} />
}
