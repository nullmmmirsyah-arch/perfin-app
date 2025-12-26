'use client'

import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { TransactionItem } from '../transactions/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, ArrowRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { cn } from '@/lib/utils'
import { useHousehold } from '@/components/HouseholdProvider'
import TransactionDrawer from '@/components/TransactionDrawer'
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
  
  const [isBudgetOpen, setIsBudgetOpen] = useState(false)
  const [isBalancesOpen, setIsBalancesOpen] = useState(false)

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

  return (
    <div className="p-8 pb-24">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

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

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Spendable Balances Card */}
        <Collapsible open={isBalancesOpen} onOpenChange={setIsBalancesOpen} className="w-full">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                <CardTitle className="text-sm font-medium text-muted-foreground">Available Spending Cash</CardTitle>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isBalancesOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.liquidCash.toLocaleString() ?? '...'}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter font-semibold">
                Money you can spend today
              </p>

              <CollapsibleContent className="mt-4 space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-1">
                {/* Cash Group */}
                <div className="space-y-1.5">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Liquid / Daily Accounts</p>
                    {summary?.cashAccounts?.map((account: { name: string, balance: number }, index: number) => (
                        <div key={index} className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">{account.name}</span>
                            <span className="font-medium">{account.balance.toLocaleString()}</span>
                        </div>
                    ))}
                </div>

                {/* Savings Group */}
                {(summary?.savingAccounts?.length ?? 0) > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-muted/20">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-success uppercase tracking-wider">Reserved for Goals</p>
                            <span className="text-[10px] text-muted-foreground font-medium italic">Total: {summary?.totalSavingsOnly.toLocaleString()}</span>
                        </div>
                        {summary?.savingAccounts?.map((account: { name: string, balance: number }, index: number) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-success/80">{account.name}</span>
                                <span className="font-medium text-success/60">{account.balance.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Assets Group */}
                {(summary?.assetAccounts?.length ?? 0) > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-muted/20">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Assets</p>
                            <span className="text-[10px] text-muted-foreground font-medium italic">Total: {summary?.totalAssetsOnly.toLocaleString()}</span>
                        </div>
                        {summary?.assetAccounts?.map((account: { name: string, balance: number }, index: number) => (
                            <div key={index} className="flex justify-between items-center text-sm">
                                <span className="text-primary/80">{account.name}</span>
                                <span className="font-medium text-primary/60">{account.balance.toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>

        {/* Budget Status Card */}
        <Collapsible open={isBudgetOpen} onOpenChange={setIsBudgetOpen} className="w-full">
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Budget & Goals</CardTitle>
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isBudgetOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.remainingBudget.toLocaleString() ?? '...'}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-tighter font-semibold">
                Remaining spending limit
              </p>
              
              <CollapsibleContent className="mt-4 space-y-4 border-t pt-4 animate-in fade-in slide-in-from-top-1">
                
                {/* Expense Group */}
                <div className="space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Daily Expenses</p>
                    {summary?.budgetBreakdown
                        ?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving')
                        .map((item: BudgetBreakdownItem, index: number) => {
                            const percentage = item.limit > 0 ? (item.spent / item.limit) * 100 : 0;
                            const isOver = item.spent > item.limit;
                            
                            return (
                                <div key={index} className="flex flex-col gap-1.5 py-2 border-b last:border-0 border-muted/30">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-muted-foreground">{item.categoryName}</span>
                                        <span className={cn(
                                            "font-medium",
                                            isOver ? "text-destructive" : ""
                                        )}>
                                            {isOver 
                                                ? `Over ${(item.spent - item.limit).toLocaleString()}` 
                                                : `${item.remaining.toLocaleString()} left`
                                            }
                                        </span>
                                    </div>
                                    {/* Bar Chart */}
                                    <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
                                        <div 
                                            className={cn("h-full rounded-full transition-all duration-500", isOver ? "bg-destructive" : "bg-primary")} 
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>{Math.round(percentage)}% used</span>
                                        <span>{item.spent.toLocaleString()} / {item.limit.toLocaleString()}</span>
                                    </div>
                                </div>
                            );
                        })}
                    {summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType !== 'saving').length === 0 && (
                        <p className="text-xs text-muted-foreground italic">No expense budgets.</p>
                    )}
                </div>

                {/* Saving Group */}
                {(summary?.budgetBreakdown?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving').length ?? 0) > 0 && (
                    <div className="space-y-3 pt-2">
                        <p className="text-[10px] font-bold text-success uppercase tracking-wider">Saving Goals Progress</p>
                        {summary?.budgetBreakdown
                            ?.filter((item: BudgetBreakdownItem) => item.categoryType === 'saving')
                            .map((item: BudgetBreakdownItem, index: number) => {
                                const target = item.targetAmount || 0;
                                const percentage = target > 0 ? (item.accumulated / target) * 100 : 0;
                                
                                return (
                                    <div key={index} className="flex flex-col gap-1.5 py-2 border-b last:border-0 border-muted/30">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-muted-foreground">{item.categoryName}</span>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="font-medium text-success">
                                                    {item.accumulated.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Bar Chart */}
                                        <div className="h-1.5 w-full bg-success/10 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-success rounded-full transition-all duration-500" 
                                                style={{ width: `${Math.min(percentage, 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between text-[10px] text-muted-foreground">
                                            <span>{item.targetAmount ? `${Math.round(percentage)}% of goal` : 'No target set'}</span>
                                            <div className="flex gap-2">
                                                {item.targetAmount && (
                                                    <span>Goal: {item.targetAmount.toLocaleString()}</span>
                                                )}
                                                <span className="italic text-success/80">
                                                    ({item.spent >= 0 ? '+' : ''}{item.spent.toLocaleString()} this month)
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
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

        <div className="grid gap-2">
          {summary?.recentTransactions?.map((transaction: TransactionWithDetails) => (
            <TransactionItem
              key={transaction._id}
              transaction={transaction}
              variant="slim"
              onEdit={() => handleEdit(transaction)}
              onDelete={() => setTransactionToDelete(transaction)}
            />
          ))}
          {summary?.recentTransactions?.length === 0 && (
            <div className="p-8 text-center border rounded-lg border-dashed bg-muted/20">
              <p className="text-muted-foreground">No transactions found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}