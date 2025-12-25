'use client'

import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { TransactionItem } from './transactions/page'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Wallet, PiggyBank, ArrowRight, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useHousehold } from '@/components/HouseholdProvider'

export default function Dashboard() {
  const { householdId } = useHousehold()
  const summary = useQuery(api.dashboard.getDashboardSummary, {
    householdId: householdId ?? undefined
  })
  const [isBudgetOpen, setIsBudgetOpen] = useState(false)
  const [isCashOpen, setIsCashOpen] = useState(false)

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <Collapsible
          open={isCashOpen}
          onOpenChange={setIsCashOpen}
          className="w-full"
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                <CardTitle className="text-sm font-medium">Total Cash Balance</CardTitle>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isCashOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.totalCash.toLocaleString() ?? '...'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Sum of all non-asset accounts
              </p>

              <CollapsibleContent className="mt-4 space-y-2 border-t pt-4 animate-in fade-in slide-in-from-top-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Balance per Account</p>
                {summary?.accountBreakdown?.map((account, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{account.name}</span>
                    <span className="font-medium">
                      {account.balance.toLocaleString()}
                    </span>
                  </div>
                ))}
                {summary?.accountBreakdown?.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No cash accounts found.</p>
                )}
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>

        <Collapsible
          open={isBudgetOpen}
          onOpenChange={setIsBudgetOpen}
          className="w-full"
        >
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-xl">
                <CardTitle className="text-sm font-medium">Remaining Budget</CardTitle>
                <div className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", isBudgetOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.remainingBudget.toLocaleString() ?? '...'}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Monthly budget limit minus expenses
              </p>
              
              <CollapsibleContent className="mt-4 space-y-2 border-t pt-4 animate-in fade-in slide-in-from-top-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Breakdown per Category</p>
                {summary?.budgetBreakdown?.map((item, index) => (
                  <div key={index} className="flex flex-col gap-1 py-1 border-b last:border-0 border-muted/30">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{item.categoryName}</span>
                      <span className={cn(
                        "font-medium",
                        item.spent > item.limit ? "text-destructive" : ""
                      )}>
                        {item.spent > item.limit 
                          ? `Over ${(item.spent - item.limit).toLocaleString()}` 
                          : item.remaining.toLocaleString()
                        }
                      </span>
                    </div>
                    {item.lastMonthPerformance !== null && item.lastMonthPerformance !== undefined && (
                      <div className={cn(
                        "text-[10px] flex items-center gap-1",
                        item.lastMonthPerformance >= 0 ? "text-success" : "text-destructive"
                      )}>
                        {item.lastMonthPerformance >= 0 
                          ? `Saved ${Math.abs(item.lastMonthPerformance).toLocaleString()} last month` 
                          : `Over ${Math.abs(item.lastMonthPerformance).toLocaleString()} last month`}
                      </div>
                    )}
                  </div>
                ))}
                {summary?.budgetBreakdown?.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No budgets set.</p>
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
          {summary?.recentTransactions?.map((transaction) => (
            <TransactionItem
              key={transaction._id}
              transaction={transaction}
              variant="slim"
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
