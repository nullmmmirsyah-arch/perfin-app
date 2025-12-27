'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import TransactionDrawer from '@/components/TransactionDrawer'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Trash2, Edit, ChevronDown } from 'lucide-react'
import TransactionFilters from '@/components/TransactionFilters'
import { DateRange } from 'react-day-picker'
import { Doc, Id } from '../../convex/_generated/dataModel'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { TransactionItem } from '@/components/TransactionItem'

type TransactionWithDetails = Omit<Doc<'transactions'>, 'splits' | 'accountId' | 'categoryId' | 'toAccountId' | 'labelId'> & {
  accountId: Id<'accounts'>;
  categoryId?: Id<'categories'>;
  toAccountId?: Id<'accounts'>;
  labelId?: Id<'labels'>;
  fromAccountName?: string;
  toAccountName?: string;
  categoryName?: string;
  label?: Doc<'labels'> | null;
  splits?: Array<{
    categoryId: Id<'categories'>;
    amount: string;
    description?: string;
    labelId?: Id<'labels'>;
    categoryName?: string;
  }>;
};

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

export default function TransactionsPage() {
  const [open, setOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  const [filters, setFilters] = useState<{
    type: string | undefined
    accountId: string | undefined
    categoryId: string | undefined
    dateRange: DateRange | undefined
  }>({
    type: undefined,
    accountId: undefined,
    categoryId: undefined,
    dateRange: undefined,
  })

  const { householdId } = useHousehold()
  const transactions = useQuery(api.transactions.get, {
    householdId: householdId ?? undefined,
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    dateRange: filters.dateRange
      ? {
          start: filters.dateRange.from?.toISOString(),
          end: filters.dateRange.to?.toISOString(),
        }
      : undefined,
  }) as TransactionWithDetails[] | undefined
  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const handleEdit = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (transactionToDelete) {
        await deleteTransaction({ id: transactionToDelete._id });
        toast.success("Transaction deleted");
        setTransactionToDelete(undefined);
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
      </div>

      <TransactionFilters filters={filters} onFilterChange={setFilters} />

      <TransactionDrawer
        open={open}
        onOpenChange={setOpen}
        transaction={selectedTransaction}
      />
      
      <AlertDialog open={!!transactionToDelete} onOpenChange={(open) => !open && setTransactionToDelete(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the transaction
              {transactionToDelete?.description ? ` "${transactionToDelete.description}"` : ''} 
              {transactionToDelete?.amount ? ` of ${transactionToDelete.amount}` : ''}
              .
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

      {transactions?.length === 0 && (
        <div className="mt-8 p-4 border rounded-md bg-muted/50">
          <p className="text-muted-foreground">
            No transactions yet. Click &quot;Create Transaction&quot; to get started.
          </p>
        </div>
      )}
      <div className="mt-8 grid grid-cols-1 gap-4">
        {transactions?.map(transaction => (
          <TransactionItem
            key={transaction._id}
            transaction={transaction}
            onEdit={() => handleEdit(transaction)}
            onDelete={() => setTransactionToDelete(transaction)}
          />
        ))}
      </div>
    </div>
  )
}

