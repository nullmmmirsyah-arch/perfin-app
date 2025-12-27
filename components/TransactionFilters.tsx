'use client'

import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { useHousehold } from '@/components/HouseholdProvider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { format } from 'date-fns'
import { Calendar } from './ui/calendar'
import { cn } from '@/lib/utils'
import { Label } from './ui/label'
import { useState } from 'react'

type TransactionFiltersProps = {
  filters: {
    type: string | undefined
    accountId: string | undefined
    categoryId: string | undefined
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
  const [open, setOpen] = useState(false);

  const handleTypeChange = (type: string) => {
    onFilterChange({ ...filters, type: type === 'all' ? undefined : type })
  }

  const handleAccountChange = (accountId: string) => {
    onFilterChange({ ...filters, accountId: accountId === 'all' ? undefined : accountId })
  }

  const handleCategoryChange = (categoryId: string) => {
    onFilterChange({ ...filters, categoryId: categoryId === 'all' ? undefined : categoryId })
  }

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFilterChange({ ...filters, dateRange })
  }

  const clearFilter = (key: keyof typeof filters) => {
    onFilterChange({ ...filters, [key]: undefined })
  }

  const activeFiltersCount = [
    filters.type,
    filters.accountId,
    filters.categoryId,
  ].filter(Boolean).length;

  const getAccountName = (id: string) => accounts?.find(a => a._id === id)?.name || id;
  const getCategoryName = (id: string) => categories?.find(c => c._id === id)?.name || id;

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
            className="w-[300px] p-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-top-2 duration-300" 
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
                    onClick={() => onFilterChange({ type: undefined, accountId: undefined, categoryId: undefined, dateRange: filters.dateRange })}
                  >
                    Reset
                  </Button>
                )}
              </div>
              <Separator className="my-2" />
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Type</Label>
                  <Select onValueChange={handleTypeChange} value={filters.type || 'all'}>
                    <SelectTrigger className={cn("h-8 transition-colors", filters.type && "bg-primary/10 border-primary/20 text-primary font-medium")}>
                      <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="expense">Expense</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</Label>
                  <Select onValueChange={handleAccountChange} value={filters.accountId || 'all'}>
                    <SelectTrigger className={cn("h-8 transition-colors", filters.accountId && "bg-primary/10 border-primary/20 text-primary font-medium")}>
                      <SelectValue placeholder="All Accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {accounts?.map(account => (
                        <SelectItem key={account._id} value={account._id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</Label>
                  <Select onValueChange={handleCategoryChange} value={filters.categoryId || 'all'}>
                    <SelectTrigger className={cn("h-8 transition-colors", filters.categoryId && "bg-primary/10 border-primary/20 text-primary font-medium")}>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories?.map(category => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filter Badges */}
      {(filters.type || filters.accountId || filters.categoryId || filters.dateRange) && (
        <div className="flex flex-wrap gap-2">
          {filters.dateRange && (
             <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1">
                <CalendarIcon className="h-3 w-3" />
                {format(filters.dateRange.from!, 'dd MMM')} 
                {filters.dateRange.to && ` - ${format(filters.dateRange.to, 'dd MMM')}`}
                <button onClick={() => handleDateChange(undefined)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
             </Badge>
          )}
          {filters.type && (
            <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1 capitalize">
              {filters.type}
              <button onClick={() => clearFilter('type')} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.accountId && (
            <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Account: {getAccountName(filters.accountId)}
              <button onClick={() => clearFilter('accountId')} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          {filters.categoryId && (
            <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Cat: {getCategoryName(filters.categoryId)}
              <button onClick={() => clearFilter('categoryId')} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onFilterChange({ type: undefined, accountId: undefined, categoryId: undefined, dateRange: undefined })}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
