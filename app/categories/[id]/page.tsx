'use client'

import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, TrendingUp, History, Wallet } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { useHousehold } from '@/components/HouseholdProvider'
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { LoadingScreen } from '@/components/LoadingScreen'

export default function CategoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as Id<"categories">
  const { householdId } = useHousehold()

  const data = useQuery(api.categories.getCategoryDetails, {
    id,
    householdId: householdId ?? undefined,
  })

  if (!data) return <LoadingScreen />

  const { category, historyData, recentTransactions } = data

  // Filter only active months (with data)
  const activeHistory = historyData.filter(d => 
      d.budgetAmount > 0 || d.spent > 0 || d.carryoverAmount !== 0 || d.sweptAmount > 0
  );

  // List view: Recent First (Reverse Chronological)
  const listHistory = [...activeHistory].reverse();

  // Group Transactions Logic
  const groupedTransactions = recentTransactions.reduce((groups, t) => {
      const date = new Date(t.date);
      let key = format(date, 'MMMM d, yyyy');
      if (isToday(date)) key = 'Today';
      else if (isYesterday(date)) key = 'Yesterday';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
      return groups;
  }, {} as Record<string, typeof recentTransactions>);

  const groupKeys = Object.keys(groupedTransactions);

  return (
    <div className="pb-24 p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {category.name}
            {category.enablePacing && (
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                    Smart Budget
                </span>
            )}
          </h1>
          <p className="text-muted-foreground capitalize">{category.type}</p>
        </div>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Trend
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activeHistory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis 
                        dataKey="label" 
                        tick={{ fontSize: 10 }} 
                        axisLine={false} 
                        tickLine={false} 
                    />
                    <Tooltip 
                        cursor={{ fill: 'transparent' }}
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const d = payload[0].payload;
                                return (
                                    <div className="bg-popover border text-popover-foreground p-2 rounded-lg shadow-lg text-xs">
                                        <p className="font-bold mb-1">{d.label} {d.year}</p>
                                        <p>Budget: {formatCurrency(d.budgetAmount)}</p>
                                        <p>Spent: {formatCurrency(d.spent)}</p>
                                        {d.sweptAmount > 0 && <p className="text-muted-foreground italic">Swept: {formatCurrency(d.sweptAmount)}</p>}
                                        {d.carryoverAmount !== 0 && <p className={d.carryoverAmount > 0 ? "text-success" : "text-destructive"}>Rollover: {formatCurrency(d.carryoverAmount)}</p>}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="budgetAmount" fill="#e2e8f0" radius={[4, 4, 0, 0]} stackId="a" />
                    <Bar dataKey="spent" radius={[4, 4, 0, 0]} stackId="b">
                        {activeHistory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.spent > entry.budgetAmount ? '#ef4444' : '#3b82f6'} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Breakdown Table */}
      <Card>
        <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Monthly History
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                {listHistory.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">No history data available.</div>
                ) : (
                    listHistory.map((month) => (
                    <div key={`${month.year}-${month.month}`} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{month.label} {month.year}</span>
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                                {month.carryoverAmount !== 0 && (
                                    <span className={cn(month.carryoverAmount > 0 ? "text-success" : "text-destructive")}>
                                        {month.carryoverAmount > 0 ? '+' : ''}{formatCurrency(month.carryoverAmount)} Roll
                                    </span>
                                )}
                                {month.sweptAmount > 0 && (
                                    <span>
                                        {formatCurrency(month.sweptAmount)} Swept
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="text-right">
                            <div className="text-sm font-semibold">
                                {formatCurrency(month.spent)}
                                <span className="text-muted-foreground font-normal text-xs ml-1">
                                    / {formatCurrency(month.budgetAmount)}
                                </span>
                            </div>
                            <div className="w-24 h-1.5 bg-muted rounded-full ml-auto mt-1 overflow-hidden">
                                <div 
                                    className={cn("h-full rounded-full", month.spent > month.budgetAmount ? "bg-destructive" : "bg-primary")} 
                                    style={{ width: `${Math.min(100, (month.spent / (month.budgetAmount || 1)) * 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                ))
                )}
            </div>
        </CardContent>
      </Card>

      {/* Transaction History Grouped */}
      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2 px-1">
            <Wallet className="h-5 w-5" />
            Recent Transactions
        </h3>
        
        {recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-xl border-dashed">
                No recent transactions.
            </div>
        ) : (
            groupKeys.map(dateKey => (
                <div key={dateKey} className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        {dateKey}
                    </h4>
                    <div className="space-y-2">
                        {groupedTransactions[dateKey].map((t) => (
                            <div key={t._id} className="bg-card p-4 rounded-xl border shadow-sm flex justify-between items-center">
                                <div className="flex flex-col gap-1">
                                    <span className="font-medium text-sm line-clamp-1">{t.description || 'No description'}</span>
                                    {t.accountName && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>{t.accountName}</span>
                                        </div>
                                    )}
                                </div>
                                <span className={cn(
                                    "font-bold text-sm",
                                    t.type === 'income' ? "text-success" : "text-foreground"
                                )}>
                                    {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  )
}