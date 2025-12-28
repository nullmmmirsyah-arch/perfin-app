'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Doc } from '../../convex/_generated/dataModel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Trash2, Edit, Archive, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
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
import { CategoriesListSkeleton } from '@/components/skeletons'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export default function CategoriesPage() {
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<Doc<'categories'> | undefined>(undefined)
  const [categoryToDelete, setCategoryToDelete] = useState<Doc<'categories'> | undefined>(undefined)
  const [categoryToArchive, setCategoryToArchive] = useState<Doc<'categories'> | undefined>(undefined)
  const [showArchived, setShowArchived] = useState(false)

  const { householdId } = useHousehold()
  
  // 1. Fetch Categories
  const categories = useQuery(api.categories.get, { 
    householdId: householdId ?? undefined,
    showArchived: true
  })

  // 2. Fetch Budget Status to get "Accumulated" values for Goals
  const now = new Date()
  const budgetStatus = useQuery(api.budgets.getBudgetStatus, { 
    householdId: householdId ?? undefined,
    month: now.getMonth(),
    year: now.getFullYear()
  })

  const deleteCategory = useMutation(api.categories.deleteCategory)
  const archiveCategory = useMutation(api.categories.archiveCategory)
  const unarchiveCategory = useMutation(api.categories.unarchiveCategory)

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

  const handleArchiveConfirm = async () => {
    if (categoryToArchive) {
        await archiveCategory({ id: categoryToArchive._id })
        toast.success("Category archived")
        setCategoryToArchive(undefined)
    }
  }

  const handleUnarchive = async (category: Doc<'categories'>) => {
      await unarchiveCategory({ id: category._id })
      toast.success("Category restored")
  }

  if (categories === undefined) {
    return <div className="p-8"><CategoriesListSkeleton /></div>
  }

  const activeCategories = categories.filter(c => !c.isArchived)
  const archivedCategories = categories.filter(c => c.isArchived)

  const incomeCategories = activeCategories.filter(c => c.type === 'income')
  const expenseCategories = activeCategories.filter(c => c.type === 'expense')
  const savingCategories = activeCategories.filter(c => c.type === 'saving')

  const formatCurrency = (val: string | number) => {
    const num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : val;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(isNaN(num) ? 0 : num);
  };

  const getProgressData = (catId: string, targetAmountStr?: string) => {
      if (!budgetStatus?.data) return { accumulated: 0, percentage: 0 };
      const item = budgetStatus.data.find(d => d.category._id === catId);
      const accumulated = item?.accumulated || 0;
      const target = targetAmountStr ? parseFloat(targetAmountStr.replace(/,/g, '')) : 0;
      const percentage = target > 0 ? Math.min((accumulated / target) * 100, 100) : 0;
      return { accumulated, percentage };
  };

  const CategoryCard = ({ category }: { category: Doc<'categories'> }) => {
    const isArchived = category.isArchived;
    const isSaving = category.type === 'saving';
    const { accumulated, percentage } = isSaving ? getProgressData(category._id, category.targetAmount) : { accumulated: 0, percentage: 0 };

    return (
      <Card className={`p-4 shadow-sm ${isArchived ? 'opacity-60 bg-muted/30' : ''}`}>
        <div className="flex flex-row justify-between items-start">
            <div className="w-full">
                <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium">{category.name}</p>
                    {isArchived && <Badge variant="secondary" className="text-xs h-5">Archived</Badge>}
                </div>
                
                {isSaving && category.targetAmount && (
                    <div className="mt-3 space-y-2 pr-4">
                         <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{formatCurrency(accumulated)} saved</span>
                            <span>Target: {formatCurrency(category.targetAmount)}</span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                        {percentage >= 100 && <p className="text-xs text-green-600 font-medium mt-1">Goal Reached! 🎉</p>}
                    </div>
                )}
            </div>

            <div className="flex-shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {!isArchived ? (
                        <>
                            <DropdownMenuItem onClick={() => handleEdit(category)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCategoryToArchive(category)}>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                            </DropdownMenuItem>
                        </>
                    ) : (
                        <DropdownMenuItem onClick={() => handleUnarchive(category)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restore
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => setCategoryToDelete(category)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
            <p className="text-muted-foreground">Manage your spending buckets and saving goals.</p>
        </div>
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
              Are you sure you want to permanently delete <strong>{categoryToDelete?.name}</strong>? 
              <br/>
              Note: Transactions linked to this category will lose their category association. 
              Use <strong>Archive</strong> instead if you just want to hide it.
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

       <AlertDialog open={!!categoryToArchive} onOpenChange={(open) => !open && setCategoryToArchive(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide <strong>{categoryToArchive?.name}</strong> from your budget list and new transaction options.
              <br/>
              History will be preserved. You can restore it later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveConfirm}>
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SAVINGS GOALS */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
            🎯 Savings Goals
            <span className="text-sm font-normal text-muted-foreground">({savingCategories.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savingCategories.map(cat => <CategoryCard key={cat._id} category={cat} />)}
            {savingCategories.length === 0 && <p className="text-sm text-muted-foreground italic col-span-2 py-2">No saving goals yet.</p>}
        </div>
      </div>

      {/* EXPENSES */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
            💸 Expenses
            <span className="text-sm font-normal text-muted-foreground">({expenseCategories.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {expenseCategories.map(cat => <CategoryCard key={cat._id} category={cat} />)}
             {expenseCategories.length === 0 && <p className="text-sm text-muted-foreground italic col-span-3 py-2">No expense categories yet.</p>}
        </div>
      </div>

       {/* INCOME */}
       <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2 border-b pb-2">
            💰 Income Sources
            <span className="text-sm font-normal text-muted-foreground">({incomeCategories.length})</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {incomeCategories.map(cat => <CategoryCard key={cat._id} category={cat} />)}
             {incomeCategories.length === 0 && <p className="text-sm text-muted-foreground italic col-span-3 py-2">No income categories yet.</p>}
        </div>
      </div>

      {/* ARCHIVED */}
      {archivedCategories.length > 0 && (
          <Collapsible open={showArchived} onOpenChange={setShowArchived} className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between">
                <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full flex justify-between p-0 hover:bg-transparent text-muted-foreground hover:text-foreground">
                        <span className="flex items-center gap-2">
                            {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            Archived Categories ({archivedCategories.length})
                        </span>
                    </Button>
                </CollapsibleTrigger>
            </div>
            <CollapsibleContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                    {archivedCategories.map(cat => <CategoryCard key={cat._id} category={cat} />)}
                </div>
            </CollapsibleContent>
          </Collapsible>
      )}
    </div>
  )
}
