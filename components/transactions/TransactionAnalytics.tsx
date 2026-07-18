"use client"

import * as React from "react"
import { Label, Pie, PieChart } from "recharts"
import { TransactionWithDetails } from "./types"
import { useQuery } from "convex/react"
import { api } from "../../convex/_generated/api"
import { DateRange } from "react-day-picker"
import { useHousehold } from "../HouseholdProvider"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { startOfMonth, endOfMonth } from "date-fns"

type Props = {
  transactions: TransactionWithDetails[]
  filters?: {
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    dateRange: DateRange | undefined
  }
}

export function TransactionAnalytics({ transactions, filters }: Props) {
  const { householdId } = useHousehold()
  
  // Prepare args for trend query
  const trendArgs = React.useMemo(() => ({
    householdId: householdId ?? undefined,
    type: filters?.type,
    accountId: filters?.accountId,
    categoryId: filters?.categoryId,
    labelId: filters?.labelId,
    dateRange: filters?.dateRange ? {
        start: filters.dateRange.from?.toISOString() || startOfMonth(new Date()).toISOString(),
        end: filters.dateRange.to?.toISOString() || endOfMonth(new Date()).toISOString(),
    } : undefined
  }), [householdId, filters]);

  const trendData = useQuery(api.transactions.getExpensesTrend, trendArgs);

  const analyticsData = React.useMemo(() => {
    // Filter only expenses for analytics
    const expenses = transactions.filter(t => t.type === 'expense')
    
    const categoryMap = new Map<string, number>()
    let total = 0

    expenses.forEach(t => {
      // Logic to check if a specific item matches current filters
      const matchesFilter = (catId?: string, labIds?: string[]) => {
          const catMatch = !filters?.categoryId || filters.categoryId.length === 0 || (catId && filters.categoryId.includes(catId));
          const labMatch = !filters?.labelId || filters.labelId.length === 0 || (labIds?.some(id => filters.labelId!.includes(id)));
          return catMatch && labMatch;
      };

      if (t.isSplit && t.splits) {
         t.splits.forEach(split => {
            // STRICT FILTER CHECK inside split
            if (matchesFilter(split.categoryId, split.labelIds)) {
                const splitAmount = parseFloat(split.amount.replace(/,/g, '') || '0')
                const catName = split.categoryName || "Uncategorized"
                categoryMap.set(catName, (categoryMap.get(catName) || 0) + splitAmount)
                total += splitAmount
            }
         })
      } else {
        // Main transaction check
        if (matchesFilter(t.categoryId, t.labelIds)) {
            const amount = parseFloat(t.amount.replace(/,/g, '') || '0')
            const catName = t.categoryName || "Uncategorized"
            categoryMap.set(catName, (categoryMap.get(catName) || 0) + amount)
            total += amount
        }
      }
    })

    const chartData = Array.from(categoryMap.entries())
      .map(([category, amount], index) => ({
        category,
        amount,
        fill: `var(--chart-${(index % 5) + 1})`,
      }))
      .sort((a, b) => b.amount - a.amount)

    return { chartData, total }
  }, [transactions])

  const chartConfig = React.useMemo(() => {
    const config: ChartConfig = {
      amount: {
        label: "Amount",
      },
    }
    analyticsData.chartData.forEach((item, index) => {
      config[item.category] = {
        label: item.category,
        color: `var(--chart-${(index % 5) + 1})`,
      }
    })
    return config
  }, [analyticsData])

  // Real Trend Data
  const percentageChange = trendData?.percentage || 0;
  const isUp = trendData?.direction === 'up';

  if (analyticsData.total === 0) {
      return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>No expense data to analyze for this period.</p>
          </div>
      )
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="items-center pb-0">
          <CardTitle>Spending Overview</CardTitle>
          <CardDescription>Current Period Analysis</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 pb-0">
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={analyticsData.chartData}
                dataKey="amount"
                nameKey="category"
                innerRadius={60}
                strokeWidth={5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-3xl font-bold"
                          >
                            {analyticsData.total.toLocaleString(undefined, {
                                maximumFractionDigits: 0,
                                style: 'currency', 
                                currency: 'IDR',
                                currencyDisplay: 'symbol'
                            }).replace(/^IDR/, '').trim()} 
                            {/* Simple formatting hack for "12.500.000" style if locale allows, or just number */}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 24}
                            className="fill-muted-foreground text-xs"
                          >
                            Total Spent
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
          
          <div className="flex justify-center mt-4">
             {trendData ? (
                 <Badge variant={isUp ? "destructive" : "default"} className="text-sm px-3 py-1">
                    {isUp ? "🔴" : "🟢"} {Math.abs(percentageChange).toFixed(1)}% vs Prior Period
                 </Badge>
             ) : (
                 <Badge variant="secondary" className="text-xs">Calculating trend...</Badge>
             )}
          </div>
        </CardContent>
      </Card>
        
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
            Category Breakdown
        </h3>
        {analyticsData.chartData.map((item) => (
            <div key={item.category} className="space-y-1">
                <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: item.fill }}
                        />
                        <span className="font-medium">{item.category}</span>
                    </div>
                    <span className="font-mono">
                        {item.amount.toLocaleString()}
                    </span>
                </div>
                <Progress 
                    value={(item.amount / analyticsData.total) * 100} 
                    className="h-2" 
                    indicatorColor={item.fill}
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                    <span>{((item.amount / analyticsData.total) * 100).toFixed(1)}%</span>
                </div>
            </div>
        ))}
      </div>
    </div>
  )
}
