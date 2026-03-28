'use client';

import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useHousehold } from '@/components/HouseholdProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ViewToggle } from '@/components/ui/view-toggle';
import { cn } from '@/lib/utils';

type ViewMode = 'table' | 'chart';

interface BudgetReportFiltersProps {
  categoryId: Id<'categories'> | null;
  onCategoryChange: (categoryId: Id<'categories'> | null) => void;
  months: number;
  onMonthsChange: (months: number) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  className?: string;
}

export function BudgetReportFilters({
  categoryId,
  onCategoryChange,
  months,
  onMonthsChange,
  viewMode,
  onViewModeChange,
  className,
}: BudgetReportFiltersProps) {
  const { householdId } = useHousehold();

  const categories = useQuery(api.categories.get, {
    type: 'expense',
    householdId: householdId ?? undefined,
  });

  return (
    <div className={cn('flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between', className)}>
      <div className="flex flex-wrap gap-3 items-center">
        <Select
          value={categoryId ?? 'all'}
          onValueChange={(value) => onCategoryChange(value === 'all' ? null : value as Id<'categories'>)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories?.map((category) => (
              <SelectItem key={category._id} value={category._id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={months.toString()} onValueChange={(value) => onMonthsChange(parseInt(value))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">3 Months</SelectItem>
            <SelectItem value="6">6 Months</SelectItem>
            <SelectItem value="12">12 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ViewToggle value={viewMode} onChange={onViewModeChange} />
    </div>
  );
}
