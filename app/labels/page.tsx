'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
import LabelDrawer from '@/components/LabelDrawer'

export default function LabelsPage() {
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<Doc<'labels'> | undefined>(undefined)

  const labels = useQuery(api.labels.get, {})
  const deleteLabel = useMutation(api.labels.deleteLabel)

  const handleCreate = () => {
    setSelectedLabel(undefined)
    setOpen(true)
  }

  const handleEdit = (label: Doc<'labels'>) => {
    setSelectedLabel(label)
    setOpen(true)
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Labels</h1>
        <Button onClick={handleCreate}>Create Label</Button>
      </div>

      <LabelDrawer
        open={open}
        onOpenChange={setOpen}
        label={selectedLabel}
      />

      <div className="mt-8">
        <div className="space-y-2">
          {labels?.map(label => (
            <div key={label._id} className="p-4 border rounded-md flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div
                  className="h-6 w-6 rounded-full"
                  style={{ backgroundColor: label.color }}
                />
                <p className="font-medium">{label.name}</p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleEdit(label)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteLabel({ id: label._id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {labels?.length === 0 && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-muted-foreground">No labels yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
