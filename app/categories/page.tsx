'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
import CategoryDrawer from '@/components/CategoryDrawer'
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

export default function CategoriesPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [categoryToDelete, setCategoryToDelete] = useState<Doc<'categories'> | undefined>(undefined)

  const { householdId } = useHousehold()
  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined })
  const deleteCategory = useMutation(api.categories.deleteCategory)

  const handleCreate = () => {
    setSelectedCategory(undefined)
    setOpen(true)
  }

  const handleEdit = (category: Doc<'categories'>) => {
    setSelectedCategory(category)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (categoryToDelete) {
      await deleteCategory({ id: categoryToDelete._id })
      toast.success("Category deleted")
      setCategoryToDelete(undefined)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={handleCreate}>Create Category</Button>
      </div>

      <CategoryDrawer
        open={open}
        onOpenChange={setOpen}
        category={selectedCategory}
      />

      <AlertDialog open={!!categoryToDelete} onOpenChange={(open) => !open && setCategoryToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Category?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the category <strong>{categoryToDelete?.name}</strong>? 
              This will permanently remove the category.
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
        <div className="space-y-2">
          {categories?.map(category => (
            <Card key={category._id} className="p-4 flex flex-row justify-between items-center shadow-sm">
              <div className="flex items-center gap-4">
                <p className="font-medium">{category.name}</p>
                <Badge
                  variant={
                    category.type === 'income' ? 'default' : 'destructive'
                  }
                >
                  {category.type}
                </Badge>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(category)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setCategoryToDelete(category)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
          {categories?.length === 0 && (
            <div className="p-4 border rounded-md bg-muted/50 text-center">
              <p className="text-muted-foreground">No categories yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}