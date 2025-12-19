'use client'

import { useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
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
import { Button } from './ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from './ui/calendar'
import { cn } from '@/lib/utils'

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
  const accounts = useQuery(api.accounts.get)
  const categories = useQuery(api.categories.get, {});

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

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select onValueChange={handleTypeChange} value={filters.type || 'all'}>
        <SelectTrigger className="w-45">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="income">Income</SelectItem>
          <SelectItem value="expense">Expense</SelectItem>
          <SelectItem value="transfer">Transfer</SelectItem>
        </SelectContent>
      </Select>

      <Select onValueChange={handleAccountChange} value={filters.accountId || 'all'}>
        <SelectTrigger className="w-45">
          <SelectValue placeholder="Account" />
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

      <Select onValueChange={handleCategoryChange} value={filters.categoryId || 'all'}>
        <SelectTrigger className="w-45">
          <SelectValue placeholder="Category" />
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={'outline'}
            className={cn(
              'w-75 justify-start text-left font-normal',
              !filters.dateRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {filters.dateRange?.from ? (
              filters.dateRange.to ? (
                <>
                  {format(filters.dateRange.from, 'LLL dd, y')} -{' '}
                  {format(filters.dateRange.to, 'LLL dd, y')}
                </>
              ) : (
                format(filters.dateRange.from, 'LLL dd, y')
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
    </div>
  )
}
