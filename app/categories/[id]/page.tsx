'use client'

import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, TrendingUp, History, Wallet, CalendarIcon, X, Filter } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { format, isToday, isYesterday } from 'date-fns'
import { useHousehold } from '@/components/HouseholdProvider'
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { LoadingScreen } from '@/components/LoadingScreen'
import { useState, useMemo } from 'react'
import { DateRange } from 'react-day-picker'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { getFiscalDate, getFiscalDateDetails, getFiscalMonthRange, calculateBudgetPace } from '@/lib/finance-utils'
import { calculateAllowance } from '@/lib/allowance-calculator'
import { Badge } from '@/components/ui/badge'
import { MultiSelect } from '@/components/ui/multi-select'
import { TransactionListGrouped } from '@/components/transactions/TransactionListGrouped'
import { TransactionWithDetails } from '@/components/transactions/types'
import TransactionDrawer from '@/components/TransactionDrawer'
import { DeleteTransactionDialog } from '@/components/transactions/DeleteTransactionDialog'
import { toast } from 'sonner'

export default function CategoryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as Id<"categories">
  const { householdId, households } = useHousehold()
  
  const currentHousehold = households.find(h => h._id === householdId)
  const budgetStartDay = currentHousehold?.budgetStartDay || 1

  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined })
  const accountOptions = useMemo(() => 
    accounts?.map(a => ({ label: a.name, value: a._id })) || [], 
  [accounts])

  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])

  // Edit & Delete State
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | undefined>(undefined)
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionWithDetails | undefined>(undefined)

  const deleteTransaction = useMutation(api.transactions.deleteTransaction)

  const defaultDateRange = useMemo(() => {
    const now = new Date()
    const fiscalDate = getFiscalDate(now, budgetStartDay)
    const range = getFiscalMonthRange(fiscalDate.getFullYear(), fiscalDate.getMonth(), budgetStartDay)
    return { from: range.start, to: range.end }
  }, [budgetStartDay])

  const [dateRange, setDateRange] = useState<DateRange | undefined>(defaultDateRange)

  const data = useQuery(api.categories.getCategoryDetails, {
    id,
    householdId: householdId ?? undefined,
    dateRange: dateRange?.from ? {
        start: dateRange.from.toISOString(),
        end: (dateRange.to || dateRange.from).toISOString(),
    } : undefined,
    accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined
  })

  if (!data) return <LoadingScreen />

  const { category, historyData, recentTransactions, weeklySpent } = data

  // Compute allowance
  const allowanceNow = new Date()
  const { year: fy, month: fm } = getFiscalDateDetails(allowanceNow.toISOString(), budgetStartDay)
  const fiscalRange = getFiscalMonthRange(fy, fm, budgetStartDay)

  // Get effective limit from historyData for current month
  const currentMonthData = historyData.find(d => d.year === fy && d.month === fm)
  const effectiveLimit = currentMonthData
    ? currentMonthData.budgetAmount + currentMonthData.carryoverAmount
    : 0
  const categorySpent = currentMonthData?.spent ?? 0

  const allowance = category.allowanceType ? calculateAllowance({
    allowanceType: category.allowanceType ?? "budget_period",
    weeklyResetDay: category.weeklyResetDay,
    budgetAmount: effectiveLimit,
    spent: categorySpent,
    weeklySpent: weeklySpent,
    fiscalPeriodStart: new Date(fiscalRange.start),
    fiscalPeriodEnd: new Date(fiscalRange.end),
    now: allowanceNow,
  }) : null

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

  // Filter only active months (with data)
  const activeHistory = historyData.filter(d => 
      d.budgetAmount > 0 || d.spent > 0 || d.carryoverAmount !== 0 || d.sweptAmount > 0
  );

  // Prepare Chart Data & Colors (Consistent with Dashboard Pacing)
  const now = new Date()
  const fiscalToday = getFiscalDate(now, budgetStartDay)
  const currentFYear = fiscalToday.getFullYear()
  const currentFMonth = fiscalToday.getMonth()

  const chartData = activeHistory.map(d => {
      const receivables = d.pendingReceivables || 0;
      const personal = Math.max(0, d.spent - receivables);
      const isCurrentMonth = d.year === currentFYear && d.month === currentFMonth;
      
      // Calculate Effective Budget (Planned + Adjustments)
      const effectiveBudget = d.budgetAmount + d.carryoverAmount;

      // Determine Status/Color Logic based on Effective Budget
      let status: 'safe' | 'warning' | 'danger' = 'safe';
      if (d.spent > effectiveBudget && effectiveBudget > 0) {
          status = 'danger';
      } else if (isCurrentMonth && category.enablePacing && effectiveBudget > 0) {
          const pacing = calculateBudgetPace(d.spent, effectiveBudget, d.year, d.month, budgetStartDay);
          status = pacing.status;
      }

      // Hex Colors
      const colors = {
          safe: { solid: '#3b82f6', light: '#93c5fd' },
          warning: { solid: '#eab308', light: '#fde047' },
          danger: { solid: '#ef4444', light: '#fca5a5' }
      };

      return {
          ...d,
          personalSpent: personal,
          receivables: receivables,
          totalSpent: d.spent,
          effectiveBudget,
          color: colors[status].solid,
          lightColor: colors[status].light,
          status
      };
  });

  // List view: Recent First (Reverse Chronological)
  const listHistory = [...chartData].reverse();

  return (
    <div className="pb-24 p-4 md:p-8 space-y-6">
      {/* Transaction Actions Components */}
      <TransactionDrawer
        open={editDrawerOpen}
        onOpenChange={setEditDrawerOpen}
        transaction={selectedTransaction}
      />
      
      <DeleteTransactionDialog 
        open={!!transactionToDelete} 
        onOpenChange={(open) => !open && setTransactionToDelete(undefined)}
        transaction={transactionToDelete}
        onConfirm={handleDeleteConfirm}
      />

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
                <BarChart data={chartData}>
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
                                    <div className="bg-popover border text-popover-foreground p-3 rounded-lg shadow-lg text-xs space-y-2">
                                        <div className="flex justify-between items-center border-b pb-1">
                                            <p className="font-bold">{d.label} {d.year}</p>
                                            {d.status === 'warning' && <span className="text-[10px] text-yellow-600 font-bold ml-2">⚡ Pacing Alert</span>}
                                            {d.status === 'danger' && <span className="text-[10px] text-destructive font-bold ml-2">⚠️ High Spending</span>}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex justify-between gap-4">
                                                <span>Budget:</span>
                                                <div className="text-right">
                                                    <p className="font-semibold">{formatCurrency(d.effectiveBudget)}</p>
                                                    {d.carryoverAmount !== 0 && (
                                                        <p className="text-[9px] text-muted-foreground">
                                                            ({formatCurrency(d.budgetAmount)} + {formatCurrency(d.carryoverAmount)} roll)
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                                <span>Spent:</span>
                                                <span className="font-semibold">{formatCurrency(d.totalSpent)}</span>
                                            </div>
                                            {d.receivables > 0 && (
                                                <div className="pl-2 border-l-2 border-blue-400 text-[10px] text-muted-foreground">
                                                    <p>• Personal: {formatCurrency(d.personalSpent)}</p>
                                                    <p>• Owed to you: {formatCurrency(d.receivables)}</p>
                                                </div>
                                            )}
                                        </div>
                                        {d.sweptAmount > 0 && <p className="text-muted-foreground italic pt-1 border-t">Swept: {formatCurrency(d.sweptAmount)}</p>}
                                        {d.carryoverAmount !== 0 && <p className={cn("pt-1 border-t", d.carryoverAmount > 0 ? "text-success" : "text-destructive")}>Rollover: {formatCurrency(d.carryoverAmount)}</p>}
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="budgetAmount" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                    
                    {/* Stacked Bar for Spent & Receivables */}
                    <Bar dataKey="personalSpent" stackId="spent" radius={[0, 0, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-p-${index}`} fill={entry.color} />
                        ))}
                    </Bar>
                    <Bar dataKey="receivables" stackId="spent" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-r-${index}`} fill={entry.lightColor} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Allowance Section */}
      {allowance && category.allowanceType && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Allowance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Mode</span>
                <span className="text-sm font-medium">
                  {category.allowanceType === 'weekly' ? 'Weekly' : 'Budget Period'}
                </span>
              </div>
              {category.allowanceType === 'weekly' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Reset Day</span>
                    <span className="text-sm font-medium">
                      {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][category.weeklyResetDay ?? 1]}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Week</span>
                    <span className="text-sm font-medium">{allowance.weekNumber}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Remaining</span>
                <span className="text-sm font-semibold">{formatCurrency(allowance.remaining)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">
                  {category.allowanceType === 'weekly' ? 'This Week' : 'Today'}
                </span>
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(allowance.allowance)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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
                            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
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
                                {month.receivables > 0 && (
                                    <span className="text-blue-600 font-medium italic">
                                        (incl. {formatCurrency(month.receivables)} lent)
                                    </span>
                                )}
                            </div>
                        </div>
                        
                        <div className="text-right">
                            <div className="text-sm font-semibold">
                                {formatCurrency(month.totalSpent)}
                                <span className="text-muted-foreground font-normal text-xs ml-1">
                                    / {formatCurrency(month.effectiveBudget)}
                                </span>
                            </div>
                            <div className="w-24 h-1.5 bg-muted rounded-full ml-auto mt-1 overflow-hidden flex">
                                <div 
                                    className="h-full" 
                                    style={{ 
                                        width: `${Math.min(100, (month.personalSpent / (month.effectiveBudget || 1)) * 100)}%`,
                                        backgroundColor: month.color
                                    }}
                                />
                                <div 
                                    className="h-full opacity-60" 
                                    style={{ 
                                        width: `${Math.min(100, (month.receivables / (month.effectiveBudget || 1)) * 100)}%`,
                                        backgroundColor: month.color
                                    }}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
            <h3 className="font-semibold text-lg flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                Recent Transactions
            </h3>

            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 relative border-dashed">
                            <Filter className="h-4 w-4 mr-2" />
                            Accounts
                            {selectedAccountIds.length > 0 && (
                                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                                    {selectedAccountIds.length}
                                </Badge>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-2" align="end">
                        <MultiSelect
                            placeholder="Filter Accounts"
                            options={accountOptions}
                            selected={selectedAccountIds}
                            onChange={setSelectedAccountIds}
                        />
                    </PopoverContent>
                </Popover>

                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={'outline'}
                            className={cn(
                                'w-[240px] justify-start text-left font-normal',
                                !dateRange && 'text-muted-foreground'
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                                dateRange.to ? (
                                    <>
                                        {format(dateRange.from, 'LLL dd')} -{' '}
                                        {format(dateRange.to, 'LLL dd')}
                                    </>
                                ) : (
                                    format(dateRange.from, 'LLL dd')
                                )
                            ) : (
                                <span>Pick a date</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={dateRange?.from}
                            selected={dateRange}
                            onSelect={setDateRange}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>

                {dateRange && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDateRange(undefined)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>

        {(dateRange || selectedAccountIds.length > 0) && (
            <div className="px-1 flex flex-wrap items-center gap-2">
                 {dateRange && (
                    <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border-none">
                        Filtered by Date
                    </Badge>
                 )}
                 {selectedAccountIds.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border-none">
                        {selectedAccountIds.length} Account{selectedAccountIds.length > 1 ? 's' : ''}
                    </Badge>
                 )}
                 <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 text-[10px] text-muted-foreground hover:text-destructive"
                    onClick={() => {
                        setDateRange(undefined);
                        setSelectedAccountIds([]);
                    }}
                 >
                    Clear All Filters
                 </Button>
                 {dateRange?.from && !dateRange.to && (
                     <span className="text-[10px] text-muted-foreground italic">Select end date to apply range</span>
                 )}
            </div>
        )}
        
        <div className="mt-4">
            <TransactionListGrouped 
                transactions={recentTransactions as TransactionWithDetails[] || []}
                onEdit={handleEdit}
                onDelete={setTransactionToDelete}
                highlightCategoryId={[id]} 
            />
        </div>
      </div>
    </div>
  )
}