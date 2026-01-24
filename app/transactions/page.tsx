'use client'

import { useState, useEffect } from 'react'
import { usePaginatedQuery, useMutation } from 'convex/react'
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
import { List, PieChart } from 'lucide-react'
import { TransactionAnalytics } from '@/components/transactions/TransactionAnalytics'
import { startOfMonth, endOfMonth } from 'date-fns'
import { getFiscalMonthRange, getFiscalDateDetails } from '@/lib/finance-utils'

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

  const { householdId, households } = useHousehold()
  const activeHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = activeHousehold?.budgetStartDay || 1;

  // Initialize filters with fiscal range if customized
  const [filters, setFilters] = useState<{
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    dateRange: DateRange | undefined
  }>(() => {
      // Lazy init to use correct start day if available immediately, 
      // but household might be loading. We'll use useEffect to correct it.
      return {
        type: undefined,
        accountId: undefined,
        categoryId: undefined,
        labelId: undefined,
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

  const { results: transactions, status, loadMore } = usePaginatedQuery(convexApi.transactions.get, {
    householdId: householdId ?? undefined,
    type: filters.type,
    accountId: filters.accountId,
    categoryId: filters.categoryId,
    labelId: filters.labelId,
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
  }, { initialNumItems: 20 })
  
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
      <PageHeader 
        title="Transactions" 
        description="View and manage your financial history." 
      />

      <div className="space-y-4">
        {/* Header Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <Tabs 
                value={activeTab} 
                onValueChange={handleTabChange} 
                className="w-full md:w-auto"
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
            <TransactionFilters filters={filters} onFilterChange={setFilters} />
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

        {transactions === undefined ? (
            <TransactionsListSkeleton />
        ) : (
            <Carousel setApi={setApi} opts={{ duration: 30 }}>
                <CarouselContent>
                    {/* LIST VIEW */}
                    <CarouselItem className="basis-full">
                         <div className="space-y-4">
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
                                highlightLabelId={filters.labelId}
                                highlightCategoryId={filters.categoryId}
                            />

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
                    </CarouselItem>
                    
                    {/* ANALYTICS VIEW */}
                    <CarouselItem className="basis-full">
                         <div className="space-y-4 px-1">
                             <TransactionAnalytics 
                                transactions={transactions as TransactionWithDetails[]} 
                                filters={filters}
                             />
                             {status === "CanLoadMore" && (
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
                        </div>
                    </CarouselItem>
                </CarouselContent>
            </Carousel>
        )}
      </div>
    </div>
  )
}
