'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { usePaginatedQuery, useQuery, useMutation } from 'convex/react'
import { api as convexApi } from '../../convex/_generated/api'
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
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { ErrorState } from '@/components/ui/error-state'

import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { List, PieChart, Search, X, Receipt } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { TransactionAnalytics } from '@/components/transactions/TransactionAnalytics'
import { startOfMonth, endOfMonth } from 'date-fns'
import { getFiscalMonthRange, getFiscalDateDetails } from '@/lib/finance-utils'
import { ExportTransactionDialog } from '@/components/transactions/ExportTransactionDialog'

export default function TransactionsPage() {
  const [open, setOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  const [activeTab, setActiveTab] = useState("list")
  const [search, setSearch] = useState("")
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const debouncedSearch = useDebounce(search, 300)

  const { householdId, households } = useHousehold()
  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  const [filters, setFilters] = useState<{
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    merchantId: string[] | undefined
    dateRange: DateRange | undefined
  }>(() => {
      return {
        type: undefined,
        accountId: undefined,
        categoryId: undefined,
        labelId: undefined,
        merchantId: undefined,
        dateRange: {
          from: startOfMonth(new Date()),
          to: endOfMonth(new Date()),
        },
      }
  })

  useEffect(() => {
      if (budgetStartDay > 1) {
          const { year, month } = getFiscalDateDetails(new Date().toISOString(), budgetStartDay);
          const { start, end } = getFiscalMonthRange(year, month, budgetStartDay);
          setFilters(prev => ({
              ...prev,
              dateRange: { from: start, to: end }
          }));
      }
  }, [budgetStartDay]);

  const isSearching = debouncedSearch.trim().length > 0

  const dateRangeParams = useMemo(() => {
    if (!filters.dateRange) return undefined;
    return {
      start: filters.dateRange.from?.toISOString(),
      end: filters.dateRange.to ? (() => {
          const d = new Date(filters.dateRange.to);
          d.setHours(23, 59, 59, 999);
          return d.toISOString();
      })() : undefined,
    };
  }, [filters.dateRange])

  const { results: transactions, status, loadMore } = usePaginatedQuery(
    convexApi.transactions.get,
    {
      householdId: householdId ?? undefined,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      labelId: filters.labelId,
      merchantId: filters.merchantId,
      dateRange: dateRangeParams,
    },
    { initialNumItems: 20 }
  )

  const searchResults = useQuery(
    convexApi.transactions.searchTransactions,
    isSearching ? {
      householdId: householdId ?? undefined,
      search: debouncedSearch,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      labelId: filters.labelId,
      merchantId: filters.merchantId,
      dateRange: dateRangeParams,
    } : "skip"
  )

  const displayTransactions = isSearching ? (searchResults ?? undefined) : transactions
  
  const deleteTransaction = useMutation(convexApi.transactions.deleteTransaction)

  const handleEdit = useCallback((transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setOpen(true)
  }, [])

  const handleDeleteConfirm = useCallback(async () => {
    if (transactionToDelete) {
        await deleteTransaction({ id: transactionToDelete._id });
        toast.success("Transaction removed");
        setTransactionToDelete(undefined);
    }
  }, [transactionToDelete, deleteTransaction])

  return (
    <div className="p-6">
      <PageHeader 
        title="Transactions" 
        description="Review, search, and manage all your transactions." 
      />

      <div className="space-y-4">
        <Tabs 
            value={activeTab} 
            onValueChange={setActiveTab} 
            className="w-full"
        >
            <TabsList className="w-full md:w-auto grid grid-cols-2 h-10">
                <TabsTrigger value="list" className="gap-2">
                    <List className="h-4 w-4" />
                    <span>List</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="gap-2">
                    <PieChart className="h-4 w-4" />
                    <span>Analytics</span>
                </TabsTrigger>
            </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                aria-label="Search transactions"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground min-h-11 min-w-11 flex items-center justify-center rounded-md transition-all duration-150 hover:scale-105"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <TransactionFilters 
                filters={filters} 
                onFilterChange={setFilters} 
                extraAction={
                    <ExportTransactionDialog currentFilters={filters} />
                }
            />
        </div>

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

        {(isSearching && searchResults === undefined) ? (
            <TransactionsListSkeleton />
        ) : !isSearching && transactions === undefined ? (
            <TransactionsListSkeleton />
        ) : (
            <ErrorBoundary fallback={<ErrorState title="Something went wrong" description="We couldn't load your transactions. Please try again." />}>
                <div className="space-y-4">
                    {activeTab === "list" ? (
                        <>
                            {(displayTransactions ?? []).length === 0 && (
                                <div className="motion-safe:animate-in motion-reduce:animate-none fade-in duration-300">
                                    {isSearching ? (
                                        <EmptyState
                                            icon={Search}
                                            title="No matching transactions"
                                            description="Try adjusting your search or filters."
                                            variant="compact"
                                        />
                                    ) : (
                                        <EmptyState
                                            icon={Receipt}
                                            title="No transactions yet"
                                            description="Start tracking your finances by adding your first transaction."
                                            action={{ label: "Add Transaction", onClick: () => setOpen(true) }}
                                            variant="illustrated"
                                        />
                                    )}
                                </div>
                            )}
                            
                            <TransactionListGrouped 
                                transactions={(displayTransactions ?? []) as TransactionWithDetails[]}
                                onEdit={handleEdit}
                                onDelete={setTransactionToDelete}
                                highlightLabelId={filters.labelId}
                                highlightCategoryId={filters.categoryId}
                            />

                            {!isSearching && status === "CanLoadMore" && (
                                <div className="mt-8 flex justify-center motion-safe:animate-in motion-reduce:animate-none fade-in duration-300">
                                    <Button 
                                        variant="outline" 
                                        onClick={() => { setIsLoadingMore(true); loadMore(20); }}
                                        disabled={isLoadingMore}
                                        className="w-full md:w-auto min-w-[200px] transition-all duration-150 hover:shadow-md"
                                    >
                                        {isLoadingMore ? "Loading..." : "Load More"}
                                    </Button>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="space-y-4 px-1">
                            <TransactionAnalytics 
                                transactions={(displayTransactions ?? []) as TransactionWithDetails[]} 
                                filters={filters}
                            />
                            {!isSearching && status === "CanLoadMore" && (
                                <div className="mt-8 flex justify-center motion-safe:animate-in motion-reduce:animate-none fade-in duration-300">
                                    <div className="text-center space-y-3">
                                        <p className="text-xs text-muted-foreground">
                                            Showing {displayTransactions?.length || 0} of more transactions. Load all for a complete analytics picture.
                                        </p>
                                        <Button 
                                            variant="outline" 
                                            onClick={() => { setIsLoadingMore(true); loadMore(50); }}
                                            disabled={isLoadingMore}
                                            className="h-9 text-xs transition-all duration-150 hover:shadow-md"
                                        >
                                            {isLoadingMore ? "Loading..." : "Load all transactions"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
