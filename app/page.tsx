'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import TransactionDrawer from '@/components/TransactionDrawer'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Trash2, Edit, Plus } from 'lucide-react'
import { Doc } from '../convex/_generated/dataModel'
import TransactionFilters from '@/components/TransactionFilters'
import { DateRange } from 'react-day-picker'

export default function Home() {
  return <Content />
}

function Content() {
  const [open, setOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<any>()

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

  const transactions = useQuery(api.transactions.get, {
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    dateRange: filters.dateRange
      ? {
          start: filters.dateRange.from?.toISOString(),
          end: filters.dateRange.to?.toISOString(),
        }
      : undefined,
  })
  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const handleEdit = (transaction: any) => {
    setSelectedTransaction(transaction)
    setOpen(true)
  }

  const handleCreate = () => {
    setSelectedTransaction(undefined)
    setOpen(true)
  }

  return (
    <div>
      <div className="md:hidden fixed bottom-4 right-8 z-50">
        <Button
          onClick={handleCreate}
          size="icon"
          className="rounded-full h-14 w-14 shadow-lg"
        >
          <Plus className="h-6 w-6" />
          <span className="sr-only">Create Transaction</span>
        </Button>
      </div>

      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Transactions</h1>
        <Button onClick={handleCreate} className="hidden md:flex">Create Transaction</Button>
      </div>

      <TransactionFilters filters={filters} onFilterChange={setFilters} />

      <TransactionDrawer
        open={open}
        onOpenChange={setOpen}
        transaction={selectedTransaction}
      />

      {transactions?.length === 0 && (
        <div className="mt-8 p-4 border rounded-md bg-muted/50">
          <p className="text-muted-foreground">
            No transactions yet. Click "Create Transaction" to get started.
          </p>
        </div>
      )}
      <div className="mt-8 grid grid-cols-1 gap-4">
        {transactions?.map(transaction => (
          <div
            key={transaction._id}
            className="p-4 border rounded-md flex justify-between items-center"
          >
            <div>
              <p className="font-medium">{transaction.description}</p>
              {transaction.type === 'transfer' && (
                <p className="text-sm font-bold text-muted-foreground">
                  {(transaction as any).fromAccountName} → {(transaction as any).toAccountName}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p
                  className={cn(
                    'font-semibold',
                    transaction.type === 'income'
                      ? 'text-primary'
                      : 'text-destructive'
                  )}
                >
                  {transaction.type === 'income' ? '+' : '-'}
                  {transaction.amount}
                </p>
                <Badge
                  variant={
                    transaction.type === 'income' ? 'default' : 'destructive'
                  }
                >
                  {transaction.type}
                </Badge>
                {(transaction as any).label && (
                  <Badge
                    className="ml-2"
                    style={{ backgroundColor: (transaction as any).label.color }}
                  >
                    {(transaction as any).label.name}
                  </Badge>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleEdit(transaction)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => deleteTransaction({ id: transaction._id })}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}