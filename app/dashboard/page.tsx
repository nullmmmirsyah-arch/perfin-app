'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { TransactionItem } from '@/components/TransactionItem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { cn, groupTransactionsByDate } from '@/lib/utils'
import { useHousehold } from '@/components/HouseholdProvider'
import TransactionDrawer from '@/components/TransactionDrawer'
import { 
  DashboardCardSkeleton, 
  RecentTransactionsSkeleton 
} from '@/components/skeletons'
import { toast } from 'sonner'
import { Doc, Id } from '../../convex/_generated/dataModel'
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

type BudgetBreakdownItem = {
  categoryName: string;
  categoryType: string;
  targetAmount?: number;
  accumulated: number;
  limit: number;
  spent: number;
  remaining: number;
};

export default function Dashboard() {
  const { householdId } = useHousehold()
  const summary = useQuery(api.dashboard.getDashboardSummary, {
    householdId: householdId ?? undefined
  })
  
  // Edit & Delete State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const handleEdit = (transaction: TransactionWithDetails) => {
    setSelectedTransaction(transaction)
    setEditDrawerOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (transactionToDelete) {
        await deleteTransaction({ id: transactionToDelete._id });
        toast.success("Transaction deleted");
        setTransactionToDelete(undefined);
    }
  }

  const DailyOperationsCard = () => (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Daily Operations</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="budget" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="budget">Budget</TabsTrigger>
            <TabsTrigger value="cash">Cash</TabsTrigger>
          </TabsList>
          
          {/* BUDGET TAB */}
          <TabsContent value="budget" className="space-y-4 animate-in fade-in-5">
             <div>
                <div className="text-2xl font-bold">
                    {summary?.remainingBudget.toLocaleString() ?? '...'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                    Remaining Monthly Budget
                </p>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving').length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No expense budgets set.</p>
                )}
                {summary?.budgetBreakdown
                    ?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving')
                    .map((item: BudgetBreakdownItem, index: number) => {
                        const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
                        const isOver = item.spent > item.limit;
                        
                        return (
                            <div key={index} className="flex flex-col gap-1.5 pb-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">{item.categoryName}</span>
                                    <span className={cn(
                                        "font-bold text-xs",
                                        isOver ? "text-destructive" : "text-primary"
                                    )}>
                                        {isOver 
                                            ? `Over ${(item.spent - item.limit).toLocaleString()}` 
                                            : `${item.remaining.toLocaleString()} left`
                                        }
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div 
                                        className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-destructive" : "bg-primary")} 
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>{Math.round(percentage)}%</span>
                                    <span>{item.spent.toLocaleString()} / {item.limit.toLocaleString()}</span>
                                </div>
                            </div>
                        );
                    })}
            </div>
          </TabsContent>

          {/* CASH TAB */}
          <TabsContent value="cash" className="space-y-4 animate-in fade-in-5">
            <div>
                <div className="text-2xl font-bold">
                    {summary?.liquidCash.toLocaleString() ?? '...'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                    Total Liquid Cash
                </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {summary?.cashAccounts?.length === 0 && <p className="text-xs text-muted-foreground italic">No cash accounts.</p>}
                {summary?.cashAccounts?.map((account: { name: string, balance: number }, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-muted/20">
                        <span className="font-medium">{account.name}</span>
                        <span>{account.balance.toLocaleString()}</span>
                    </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  const WealthCard = () => (
    <Card className="w-full h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wealth & Goals</CardTitle>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="goals" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="goals">Goals</TabsTrigger>
            <TabsTrigger value="savings">Savings</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>

          {/* GOALS TAB */}
          <TabsContent value="goals" className="space-y-4 animate-in fade-in-5">
             <div>
                <div className="text-2xl font-bold text-success">
                    {summary?.budgetBreakdown
                        ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                        .reduce((acc: number, item: BudgetBreakdownItem) => acc + item.accumulated, 0)
                        .toLocaleString() ?? '0'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                    Accumulated Goal Progress
                </p>
            </div>
            <div className="space-y-3 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving').length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No saving goals set.</p>
                )}
                {summary?.budgetBreakdown
                    ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                    .map((item: BudgetBreakdownItem, index: number) => {
                        const target = item.targetAmount || 0;
                        const percentage = target > 0 ? (item.accumulated / target) * 100 : 0;
                        
                        return (
                            <div key={index} className="flex flex-col gap-1.5 pb-2">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground font-medium">{item.categoryName}</span>
                                    <span className="font-bold text-xs text-success">
                                        {item.accumulated.toLocaleString()}
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-success/10 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-success rounded-full transition-all duration-500" 
                                        style={{ width: `${Math.min(percentage, 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] text-muted-foreground">
                                    <span>{item.targetAmount ? `${Math.round(percentage)}%` : 'No Target'}</span>
                                    <span>Goal: {item.targetAmount ? item.targetAmount.toLocaleString() : '∞'}</span>
                                </div>
                            </div>
                        );
                    })}
            </div>
          </TabsContent>

          {/* SAVINGS TAB */}
          <TabsContent value="savings" className="space-y-4 animate-in fade-in-5">
            <div>
                <div className="text-2xl font-bold text-success">
                    {summary?.totalSavingsOnly.toLocaleString() ?? '...'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                    Total In Savings Accounts
                </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {(summary?.savingAccounts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground italic">No saving accounts.</p>}
                {summary?.savingAccounts?.map((account: { name: string, balance: number }, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-success/10 text-success">
                        <span className="font-medium">{account.name}</span>
                        <span>{account.balance.toLocaleString()}</span>
                    </div>
                ))}
            </div>
          </TabsContent>

          {/* ASSETS TAB */}
          <TabsContent value="assets" className="space-y-4 animate-in fade-in-5">
            <div>
                <div className="text-2xl font-bold text-primary">
                    {summary?.totalAssetsOnly.toLocaleString() ?? '...'}
                </div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-tighter font-semibold">
                    Total Assets Value
                </p>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                {(summary?.assetAccounts?.length ?? 0) === 0 && <p className="text-xs text-muted-foreground italic">No assets.</p>}
                {summary?.assetAccounts?.map((account: { name: string, balance: number }, index: number) => (
                    <div key={index} className="flex justify-between items-center text-sm p-2 rounded-md bg-primary/10 text-primary">
                        <span className="font-medium">{account.name}</span>
                        <span>{account.balance.toLocaleString()}</span>
                    </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-8 pb-24 md:pb-8">
      <h1 className="text-2xl font-bold mb-6 md:mb-8">Dashboard</h1>

      {/* Transaction Actions Components */}
      <TransactionDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
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

      {/* Mobile: Swipeable Cards (Carousel) */}
      <div className="block md:hidden mb-8 -mx-4 px-4">
        {summary === undefined ? (
            <div className="flex gap-4 overflow-hidden">
                <div className="basis-[85%] shrink-0">
                    <DashboardCardSkeleton />
                </div>
                <div className="basis-[85%] shrink-0">
                    <DashboardCardSkeleton />
                </div>
            </div>
        ) : (
            <Carousel 
                opts={{ align: "start", loop: false }}
                className="w-full"
            >
                <CarouselContent className="-ml-4">
                    <CarouselItem className="pl-4 basis-[85%]">
                        <DailyOperationsCard />
                    </CarouselItem>
                    <CarouselItem className="pl-4 basis-[85%]">
                        <WealthCard />
                    </CarouselItem>
                </CarouselContent>
            </Carousel>
        )}
      </div>

      {/* Desktop: Grid Layout */}
      <div className="hidden md:grid gap-6 md:grid-cols-2 mb-8">
        {summary === undefined ? (
            <>
                <DashboardCardSkeleton />
                <DashboardCardSkeleton />
            </>
        ) : (
            <>
                <DailyOperationsCard />
                <WealthCard />
            </>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Recent Transactions</h2>
          <Button variant="ghost" asChild>
            <Link href="/transactions" className="flex items-center gap-2">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {summary === undefined ? (
            <RecentTransactionsSkeleton />
        ) : (
            <div className="grid gap-4">
              {(() => {
                const groupedTransactions = groupTransactionsByDate(summary?.recentTransactions || []);
                const sortedDates = Object.keys(groupedTransactions); 
                
                if (sortedDates.length === 0) {
                    return (
                        <div className="p-8 text-center border rounded-lg border-dashed bg-muted/20">
                            <p className="text-muted-foreground">No transactions found.</p>
                        </div>
                    );
                }

                return sortedDates.map((date) => (
                  <div key={date} className="space-y-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 bg-background/95 backdrop-blur py-2 z-10">
                        {date}
                    </h3>
                    <div className="grid gap-2">
                        {groupedTransactions[date].map((transaction: TransactionWithDetails) => (
                        <TransactionItem
                            key={transaction._id}
                            transaction={transaction}
                            variant="slim"
                            onEdit={() => handleEdit(transaction)}
                            onDelete={() => setTransactionToDelete(transaction)}
                        />
                        ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
        )}
      </div>
    </div>
  )
}
