'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fadeInUp } from '@/lib/animations'
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

import { PageHeader } from '@/components/PageHeader'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { List, PieChart, Search, X } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { TransactionAnalytics } from '@/components/transactions/TransactionAnalytics'
import { startOfMonth, endOfMonth } from 'date-fns'
import { getFiscalMonthRange, getFiscalDateDetails } from '@/lib/finance-utils'
import { ExportTransactionDialog } from '@/components/transactions/ExportTransactionDialog'

import { 
  type CarouselApi, 
  Carousel, 
  CarouselContent, 
  CarouselItem 
} from "@/components/ui/carousel"

export default function TransactionsPage() {
  const [open, setOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  // Carousel & Tab State
  const [api, setApi] = useState<CarouselApi>()
  const [activeTab, setActiveTab] = useState("list")
  const [search, setSearch] = useState("")
  const debouncedSearch = useDebounce(search, 300)

  const { householdId, households } = useHousehold()
  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  // Initialize filters with fiscal range if customized
  const [filters, setFilters] = useState<{
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    merchantId: string[] | undefined
    dateRange: DateRange | undefined
  }>(() => {
      // Lazy init to use correct start day if available immediately, 
      // but household might be loading. We'll use useEffect to correct it.
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

  // Sync Date Range with Fiscal Settings
  // Only update on initial load/change of settings to avoid overwriting user manual selection
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

  const { results: transactions, status, loadMore } = usePaginatedQuery(
    convexApi.transactions.get,
    {
      householdId: householdId ?? undefined,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      labelId: filters.labelId,
      merchantId: filters.merchantId,
      dateRange: filters.dateRange
        ? {
            start: filters.dateRange.from?.toISOString(),
            end: filters.dateRange.to ? (() => {
                const d = new Date(filters.dateRange.to);
                d.setHours(23, 59, 59, 999);
                return d.toISOString();
            })() : undefined,
          }
        : undefined,
    },
    { initialNumItems: 20 }
  )

  const searchResults = useQuery(
    convexApi.transactions.searchTransactions,
    {
      householdId: householdId ?? undefined,
      search: debouncedSearch,
      type: filters.type,
      accountId: filters.accountId,
      categoryId: filters.categoryId,
      labelId: filters.labelId,
      merchantId: filters.merchantId,
      dateRange: filters.dateRange
        ? {
            start: filters.dateRange.from?.toISOString(),
            end: filters.dateRange.to ? (() => {
                const d = new Date(filters.dateRange.to);
                d.setHours(23, 59, 59, 999);
                return d.toISOString();
            })() : undefined,
          }
        : undefined,
    }
  )

  const displayTransactions = isSearching ? (searchResults ?? undefined) : transactions
  
  const deleteTransaction = useMutation(convexApi.transactions.deleteTransaction)

  // Sync Carousel -> Tab
  useEffect(() => {
    if (!api) return
    
    api.on("select", () => {
      setActiveTab(api.selectedScrollSnap() === 0 ? "list" : "analytics")
    })
  }, [api])

  // Sync Tab -> Carousel
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (api) {
        api.scrollTo(value === "list" ? 0 : 1)
    }
  }

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
      <motion.div variants={fadeInUp} initial="hidden" animate="visible">
        <PageHeader 
          title="Transactions" 
          description="View and manage your financial history." 
        />
      </motion.div>

      <div className="space-y-4">
        {/* Tabs */}
        <Tabs 
            value={activeTab} 
            onValueChange={handleTabChange} 
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

        {/* Controls Toolbar */}
        <motion.div className="flex flex-wrap items-center gap-2" variants={fadeInUp} initial="hidden" animate="visible">
            {/* Search Bar */}
            <div className="relative w-full sm:w-auto sm:min-w-[200px] md:w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
        </motion.div>

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
            <Carousel setApi={setApi} opts={{ duration: 30 }}>
                <CarouselContent>
                    {/* LIST VIEW */}
                    <CarouselItem className="basis-full">
                         <motion.div className="space-y-4" variants={fadeInUp} initial="hidden" animate="visible">
                            {(displayTransactions ?? []).length === 0 && (
                                <div className="mt-8 p-4 border rounded-md bg-muted/50">
                                <p className="text-muted-foreground">
                                    {isSearching
                                        ? "No transactions matching your search."
                                        : "No transactions yet. Click \"Create Transaction\" to get started."}
                                </p>
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
                        </motion.div>
                    </CarouselItem>
                    
                    {/* ANALYTICS VIEW */}
                    <CarouselItem className="basis-full">
                         <motion.div className="space-y-4 px-1" variants={fadeInUp} initial="hidden" animate="visible">
                              {activeTab === "analytics" && (
                              <TransactionAnalytics 
                                 transactions={(displayTransactions ?? []) as TransactionWithDetails[]} 
                                filters={filters}
                             />
                              )}
                             {!isSearching && status === "CanLoadMore" && (
                                <div className="mt-8 flex justify-center">
                                    <p className="text-xs text-muted-foreground">
                                        * Analytics currently showing only loaded transactions. 
                                        <Button 
                                            variant="link" 
                                            onClick={() => loadMore(50)}
                                            className="h-auto p-0 ml-1"
                                        >
                                            Load more data
                                        </Button>
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </CarouselItem>
                </CarouselContent>
            </Carousel>
        )}
      </div>
    </div>
  )
}
