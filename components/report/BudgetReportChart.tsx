'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartContainer, ChartConfig } from '@/components/ui/chart';
import { formatCurrency } from '@/lib/utils';
import {
  ResponsiveContainer,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  ComposedChart,
  Tooltip,
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

const chartConfig = {
  initial: {
    label: 'Initial',
    theme: {
      light: '#3b82f6',
      dark: '#3b82f6',
    },
  },
  adjustment: {
    label: 'Adjustment',
    theme: {
      light: '#649df9',
      dark: '#649df9',
    },
  },
  carryover: {
    label: 'Carryover',
    theme: {
      light: '#f59e0b',
      dark: '#f59e0b',
    },
  },
  spent: {
    label: 'Spent',
    theme: {
      light: '#8b5cf6',
      dark: '#a78bfa',
    },
  },
} satisfies ChartConfig;

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const initial = payload.find(p => p.dataKey === 'Initial')?.value || 0;
  const adjustment = payload.find(p => p.dataKey === 'Adjustment')?.value || 0;
  const carryover = payload.find(p => p.dataKey === 'Carryover')?.value || 0;
  const total = payload.find(p => p.dataKey === 'Total')?.value || 0;
  const spent = payload.find(p => p.dataKey === 'Spent')?.value || 0;

  return (
    <div className="bg-background border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Initial:</span>
          <span className="font-medium text-[#3b82f6]">{formatCurrency(initial, { isPrivacyMode: false })}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Adjustment:</span>
          <span className={`font-medium ${adjustment >= 0 ? 'text-[#649df9]' : 'text-destructive'}`}>
            {adjustment >= 0 ? '+' : ''}{formatCurrency(adjustment, { isPrivacyMode: false })}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Carryover:</span>
          <span className={`font-medium ${carryover >= 0 ? 'text-[#f59e0b]' : 'text-destructive'}`}>
            {carryover >= 0 ? '+' : ''}{formatCurrency(carryover, { isPrivacyMode: false })}
          </span>
        </div>
        <div className="border-t pt-1 mt-1 flex justify-between items-center">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-bold">{formatCurrency(total, { isPrivacyMode: false })}</span>
        </div>
        <div className="border-t pt-1 mt-1 flex justify-between items-center">
          <span className="text-muted-foreground">Spent:</span>
          <span className="font-bold text-[#8b5cf6]">{formatCurrency(spent, { isPrivacyMode: false })}</span>
        </div>
      </div>
    </div>
  );
}

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
        <ChartContainer config={chartConfig} className="h-[300px] w-full md:h-[400px]">
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
            <Bar dataKey="Initial" stackId="a" fill="var(--color-initial)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Adjustment" stackId="a" fill="var(--color-adjustment)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Carryover" stackId="a" fill="var(--color-carryover)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Total" fill="transparent" stackId="a" />
            <Line 
              type="monotone" 
              dataKey="Spent" 
              stroke="var(--color-spent)" 
              strokeWidth={3}
              dot={{ fill: 'var(--color-spent)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: 'var(--color-spent)' }}
            />
          </ComposedChart>
        </ChartContainer>

        {/* Legend explanation */}
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#3b82f6]" />
            <span>Initial (Base Allocation)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#649df9]" />
            <span>Adjustment (Move Funds)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-[#f59e0b]" />
            <span>Carryover (From Previous Month)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-[#8b5cf6]" />
            <span>Spent (Actual)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
