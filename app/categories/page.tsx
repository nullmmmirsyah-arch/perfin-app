'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit } from 'lucide-react'
import CategoryDrawer from '@/components/CategoryDrawer'

export default function CategoriesPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)

  const categories = useQuery(api.categories.get, {})
  const deleteCategory = useMutation(api.categories.deleteCategory)

  const handleCreate = () => {
    setSelectedCategory(undefined)
    setOpen(true)
  }

  const handleEdit = (category: Doc<'categories'>) => {
    setSelectedCategory(category)
    setOpen(true)
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

      <div className="mt-8">
        <div className="space-y-2">
          {categories?.map(category => (
            <div key={category._id} className="p-4 border rounded-md flex justify-between items-center">
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
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleEdit(category)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteCategory({ id: category._id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          {categories?.length === 0 && (
            <div className="p-4 border rounded-md bg-muted/50">
              <p className="text-muted-foreground">No categories yet. Create one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
