'use client'

import { useState } from 'react'
import { usePaginatedQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import TransactionDrawer from '@/components/TransactionDrawer'
import { Button } from '@/components/ui/button'
import TransactionFilters from '@/components/TransactionFilters'
import { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import { useHousehold } from '@/components/HouseholdProvider'
import { TransactionsListSkeleton } from '@/components/skeletons'
import { TransactionListGrouped } from '@/components/transactions/TransactionListGrouped'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { TransactionWithDetails } from '@/components/transactions/types'

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
  const { results: transactions, status, loadMore } = usePaginatedQuery(api.transactions.get, {
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
  }, { initialNumItems: 20 })
  
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
      
      <DeleteTransactionDialog 
        open={!!transactionToDelete} 
        onOpenChange={(open) => !open && setTransactionToDelete(undefined)}
        transaction={transactionToDelete}
        onConfirm={handleDeleteConfirm}
      />

      {transactions === undefined ? (
        <TransactionsListSkeleton />
      ) : (
        <>
          {transactions.length === 0 && (
            <div className="mt-8 p-4 border rounded-md bg-muted/50">
              <p className="text-muted-foreground">
                No transactions yet. Click &quot;Create Transaction&quot; to get started.
              </p>
            </div>
          )}
          
          <TransactionListGrouped 
            transactions={transactions as TransactionWithDetails[]}
            onEdit={handleEdit}
            onDelete={setTransactionToDelete}
          />
        </>
      )}

      {status === "CanLoadMore" && (
        <div className="mt-8 flex justify-center">
            <Button 
                variant="outline" 
                onClick={() => loadMore(20)}
                className="w-full md:w-auto min-w-[200px]"
            >
                Load More
            </Button>
        </div>
      )}
    </div>
  )
}