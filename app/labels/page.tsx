'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal as MoreIcon, Trash2 as TrashIcon, Edit as EditIcon } from 'lucide-react'
import LabelDrawer from '@/components/LabelDrawer'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { LabelsListSkeleton } from '@/components/skeletons'

export default function LabelsPage() {
  const [open, setOpen] = useState(false)
  const [selectedLabel, setSelectedLabel] = useState<Doc<'labels'> | undefined>(undefined)
  const [labelToDelete, setLabelToDelete] = useState<Doc<'labels'> | undefined>(undefined)

  const { householdId } = useHousehold()
  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined })
  const deleteLabel = useMutation(api.labels.deleteLabel)

  const handleCreate = () => {
    setSelectedLabel(undefined)
    setOpen(true)
  }

  const handleEdit = (label: Doc<'labels'>) => {
    setSelectedLabel(label)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (labelToDelete) {
      await deleteLabel({ id: labelToDelete._id })
      toast.success("Label deleted")
      setLabelToDelete(undefined)
    }
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

      <AlertDialog open={!!labelToDelete} onOpenChange={(open) => !open && setLabelToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Label?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the label <strong>{labelToDelete?.name}</strong>? 
              This will permanently remove the label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="mt-8">
        {labels === undefined ? (
          <LabelsListSkeleton />
        ) : (
          <div className="space-y-2">
            {labels.map(label => (
              <Card key={label._id} className="p-4 flex flex-row justify-between items-center shadow-sm">
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
                      <MoreIcon className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(label)}>
                      <EditIcon className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setLabelToDelete(label)}
                    >
                      <TrashIcon className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </Card>
            ))}
            {labels.length === 0 && (
              <div className="p-4 border rounded-md bg-muted/50 text-center">
                <p className="text-muted-foreground">No labels yet. Create one to get started.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}