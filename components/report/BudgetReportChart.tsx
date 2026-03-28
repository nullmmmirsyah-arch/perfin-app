'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from 'recharts';

interface PeriodData {
  year: number;
  month: number;
  periodLabel: string;
  initial: number;
  adjustment: number;
  carryover: number;
  total: number;
  spent: number;
  remaining: number;
}

interface BudgetReportChartProps {
  periods: PeriodData[];
  isLoading?: boolean;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-blue-500">
            <span className="text-muted-foreground">Initial: </span>
            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(payload.find((p: any) => p.dataKey === 'initial')?.value || 0)}
          </p>
          <p className="text-green-500">
            <span className="text-muted-foreground">Adjustment: </span>
            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(payload.find((p: any) => p.dataKey === 'adjustment')?.value || 0)}
          </p>
          <p className="text-amber-500">
            <span className="text-muted-foreground">Carryover: </span>
            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(payload.find((p: any) => p.dataKey === 'carryover')?.value || 0)}
          </p>
          <p className="text-purple-500">
            <span className="text-muted-foreground">Total: </span>
            {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(payload.find((p: any) => p.dataKey === 'total')?.value || 0)}
          </p>
          <div className="border-t pt-1 mt-1">
            <p className="text-primary font-medium">
              <span className="text-muted-foreground font-normal">Spent: </span>
              {new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(payload.find((p: any) => p.dataKey === 'spent')?.value || 0)}
            </p>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function BudgetReportChart({ periods, isLoading, className }: BudgetReportChartProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (periods.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No budget data available</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = periods.map((period) => ({
    name: period.periodLabel,
    Initial: period.initial,
    Adjustment: period.adjustment,
    Carryover: period.carryover,
    Total: period.total,
    Spent: period.spent,
  }));

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Budget Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                  return value;
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="rect"
              />
              <Bar dataKey="Initial" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Adjustment" stackId="a" fill="hsl(var(--success))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Carryover" stackId="a" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Total" fill="transparent" stackId="a" />
              <Line 
                type="monotone" 
                dataKey="Spent" 
                stroke="hsl(var(--primary))" 
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend explanation */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-1))]" />
            <span>Initial (Base Allocation)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--success))]" />
            <span>Adjustment (Move Funds)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[hsl(var(--chart-3))]" />
            <span>Carryover (From Previous Month)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[hsl(var(--primary))]" />
            <span>Spent (Actual)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
