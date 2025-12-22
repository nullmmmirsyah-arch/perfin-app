'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
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
import { MoreHorizontal, Trash2, Edit, ChevronDown } from 'lucide-react'
import TransactionFilters from '@/components/TransactionFilters'
import { DateRange } from 'react-day-picker'
import { Doc, Id } from '../../convex/_generated/dataModel'

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

export default function TransactionsPage() {
  const [open, setOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | undefined>(undefined)

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
  }) as TransactionWithDetails[] | undefined
  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const handleEdit = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setOpen(true)
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
            onDelete={() => deleteTransaction({ id: transaction._id })}
          />
        ))}
      </div>
    </div>
  )
}

export function TransactionItem({ 
  transaction, 
  onEdit, 
  onDelete,
  variant = 'default'
}: { 
  transaction: TransactionWithDetails, 
  onEdit?: () => void, 
  onDelete?: () => void,
  variant?: 'default' | 'slim'
}) {
  const [isOpen, setIsOpen] = useState(false)
  const isSlim = variant === 'slim'

  return (
    <div className={cn("border rounded-md overflow-hidden bg-card", isSlim ? "shadow-none" : "shadow-sm")}>
      <div className={cn(
        "flex justify-between items-center hover:bg-muted/30 transition-colors",
        isSlim ? "p-2 px-3" : "p-4"
      )}>
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            className={cn("p-0 h-6 w-6 shrink-0", isSlim && "h-4 w-4")}
            onClick={() => setIsOpen(!isOpen)}
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isSlim && "h-3 w-3", isOpen && "rotate-180")} />
            <span className="sr-only">Toggle Details</span>
          </Button>
          <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
            {transaction.type === 'transfer' ? (
              <>
                <p className={cn("font-medium", isSlim ? "text-sm" : "text-base")}>
                  {transaction.fromAccountName} <span className="text-muted-foreground">→</span> {transaction.toAccountName}
                </p>
                {transaction.description && !isSlim && (
                  <p className="text-sm text-muted-foreground">
                    {transaction.description}
                  </p>
                )}
              </>
            ) : (
              <p className={cn("font-medium", isSlim ? "text-sm" : "text-base")}>
                {!isSlim && <span className="text-muted-foreground font-normal mr-1">{transaction.fromAccountName}:</span>}
                {transaction.isSplit ? 'Split transaction' : (transaction.description || 'No description')}
              </p>
            )}
            {!isSlim && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(transaction.date).toLocaleDateString()}
              </p>
            )}
            {isSlim && transaction.categoryName && (
               <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{transaction.categoryName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p
              className={cn(
                'font-semibold',
                isSlim ? "text-sm" : "text-base",
                transaction.type === 'expense'
                  ? 'text-destructive'
                  : 'text-default'
              )}
            >
              {transaction.type === 'expense' && '-' }
              {transaction.amount}
            </p>
            {!isSlim && (
              <div className="flex gap-1 justify-end items-center mt-1">
                <Badge
                  variant={
                    transaction.type === 'expense' ? 'destructive' : 'default'
                  }
                  className="text-[10px] py-0 h-4"
                >
                  {transaction.type}
                </Badge>
                {transaction.label && (
                  <Badge
                    className="text-[10px] py-0 h-4"
                    style={{ backgroundColor: transaction.label.color }}
                  >
                    {transaction.label.name}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {(onEdit || onDelete) && !isSlim && (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                {onEdit && (
                    <DropdownMenuItem onClick={onEdit}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                )}
                {onDelete && (
                    <DropdownMenuItem
                        className="text-destructive"
                        onClick={onDelete}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                    </DropdownMenuItem>
                )}
                </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {isOpen && (
        <div className="border-t bg-muted/10 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
          {transaction.isSplit ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Breakdown</p>
              {transaction.splits?.map((split, index) => (
                <div key={index} className="flex justify-between items-start text-sm border-b border-muted last:border-0 pb-2 last:pb-0">
                  <div className="flex flex-col">
                    <span className="font-medium">{split.description || 'No description'}</span>
                    <span className="text-muted-foreground text-xs">{split.categoryName || 'Uncategorized'}</span> 
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">{split.amount}</span>
                    {split.labelId && <p className="text-[10px] text-muted-foreground">Has Label</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Category</p>
                <p>{transaction.categoryName || 'Uncategorized'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                <p className="text-muted-foreground italic">&quot;{transaction.description || 'No description'}&quot;</p>
              </div>
              {transaction.assetDetails && (
                <div className="col-span-2 mt-2 pt-2 border-t">
                   <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Asset Details</p>
                   <p>Quantity: <span className="font-medium">{transaction.assetDetails.quantity}</span></p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
