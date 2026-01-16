'use client'

import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useHousehold } from '@/components/HouseholdProvider'
import { DateRange } from 'react-day-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { CalendarIcon, Filter, X } from 'lucide-react'
import { Calendar } from './ui/calendar'
import { cn } from '@/lib/utils'
import { Label } from './ui/label'
import { useState } from 'react'
import { MultiSelect, Option } from './ui/multi-select'
import { format } from 'date-fns'

type TransactionFiltersProps = {
  filters: {
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    dateRange: DateRange | undefined
  }
  onFilterChange: (filters: TransactionFiltersProps['filters']) => void
}

export default function TransactionFilters({
  filters,
  onFilterChange,
}: TransactionFiltersProps) {
  const { householdId } = useHousehold()
  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined })
  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined });
  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });
  const [open, setOpen] = useState(false);

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFilterChange({ ...filters, dateRange })
  }

  const activeFiltersCount = (filters.type?.length || 0) + 
                             (filters.accountId?.length || 0) + 
                             (filters.categoryId?.length || 0) + 
                             (filters.labelId?.length || 0);

  const typeOptions: Option[] = [
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Transfer', value: 'transfer' },
  ];

  const accountOptions: Option[] = accounts?.map(a => ({ label: a.name, value: a._id })) || [];
  const categoryOptions: Option[] = categories?.map(c => ({ label: c.name, value: c._id })) || [];
  const labelOptions: Option[] = labels?.map(l => ({ label: l.name, value: l._id })) || [];

  return (
    <div className="space-y-4 mb-6">
      <div className="flex flex-wrap items-center gap-2">
        {/* Date Picker - Always Visible */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              id="date"
              variant={'outline'}
              className={cn(
                'w-[240px] justify-start text-left font-normal',
                !filters.dateRange && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dateRange?.from ? (
                filters.dateRange.to ? (
                  <>
                    {format(filters.dateRange.from, 'LLL dd')} -{' '}
                    {format(filters.dateRange.to, 'LLL dd')}
                  </>
                ) : (
                  format(filters.dateRange.from, 'LLL dd')
                )
              ) : (
                <span>Pick a date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={filters.dateRange?.from}
              selected={filters.dateRange}
              onSelect={handleDateChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Filter Button & Popover */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 relative">
              <Filter className="h-4 w-4" />
              Filter
              {activeFiltersCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground absolute -top-2 -right-2">
                  {activeFiltersCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            className="w-xs p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2 duration-300" 
            align="start"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-medium leading-none text-sm">Filter Transactions</h4>
                  <p className="text-xs text-muted-foreground">
                    Refine the list immediately.
                  </p>
                </div>
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onFilterChange({ type: undefined, accountId: undefined, categoryId: undefined, labelId: undefined, dateRange: filters.dateRange })}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <Separator className="my-2" />
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                  <MultiSelect
                    options={typeOptions}
                    selected={filters.type || []}
                    onChange={(val) => onFilterChange({ ...filters, type: val.length > 0 ? val : undefined })}
                    placeholder="All Types"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</Label>
                  <MultiSelect
                    options={accountOptions}
                    selected={filters.accountId || []}
                    onChange={(val) => onFilterChange({ ...filters, accountId: val.length > 0 ? val : undefined })}
                    placeholder="All Accounts"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                  <MultiSelect
                    options={categoryOptions}
                    selected={filters.categoryId || []}
                    onChange={(val) => onFilterChange({ ...filters, categoryId: val.length > 0 ? val : undefined })}
                    placeholder="All Categories"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Label</Label>
                  <MultiSelect
                    options={labelOptions}
                    selected={filters.labelId || []}
                    onChange={(val) => onFilterChange({ ...filters, labelId: val.length > 0 ? val : undefined })}
                    placeholder="All Labels"
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filter Badges */}
      {(activeFiltersCount > 0 || filters.dateRange) && (
        <div className="flex flex-wrap gap-2">
          {filters.dateRange && (
             <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1">
                <CalendarIcon className="h-3 w-3" />
                {format(filters.dateRange.from!, 'dd MMM')} 
                {filters.dateRange.to && ` - ${format(filters.dateRange.to, 'dd MMM')}`}
                <button onClick={() => handleDateChange(undefined)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
             </Badge>
          )}
          {filters.type?.map(t => (
            <Badge key={t} variant="secondary" className="gap-1 rounded-md px-2 py-1 capitalize">
              {t}
              <button onClick={() => onFilterChange({ ...filters, type: filters.type?.filter(i => i !== t) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {filters.accountId?.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Acc: {accountOptions.find(o => o.value === id)?.label || id}
              <button onClick={() => onFilterChange({ ...filters, accountId: filters.accountId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {filters.categoryId?.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Cat: {categoryOptions.find(o => o.value === id)?.label || id}
              <button onClick={() => onFilterChange({ ...filters, categoryId: filters.categoryId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {filters.labelId?.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Lbl: {labelOptions.find(o => o.value === id)?.label || id}
              <button onClick={() => onFilterChange({ ...filters, labelId: filters.labelId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onFilterChange({ type: undefined, accountId: undefined, categoryId: undefined, labelId: undefined, dateRange: undefined })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
