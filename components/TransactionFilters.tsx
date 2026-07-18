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
import {
  Filter, X, Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  Briefcase, Building, GraduationCap, BookOpen, Laptop, Code,
  Car, Bus, Plane, Train, Bike, Ship, Fuel,
  Coffee, UtensilsCrossed, ShoppingBag, Apple, Beer, Cake,
  Activity, Pill, Stethoscope, Dumbbell, Moon,
  Users, User, Baby, PawPrint,
  Clock, MapPin, Phone, Music, Camera, Umbrella,
  Wrench, Hammer, Palette, Zap, Globe, Bookmark, Shield,
  TrendingUp, DollarSign, BarChart3, Folder, FileText, Hash,
} from 'lucide-react'

const ICON_MAP: Record<string, React.ElementType> = {
  Tag, Home, Heart, Star, Gift, Sparkles, Gem, Crown, Flame,
  Wallet, CreditCard, Banknote, Coins, PiggyBank, Receipt,
  DollarSign, TrendingUp, BarChart3, Briefcase, Building,
  GraduationCap, BookOpen, Laptop, Code, Car, Bus, Plane,
  Train, Bike, Ship, Fuel, Coffee, UtensilsCrossed, ShoppingBag,
  Apple, Beer, Cake, Activity, Pill, Stethoscope, Dumbbell,
  Moon, Users, User, Baby, PawPrint, Clock, MapPin, Phone,
  Music, Camera, Umbrella, Wrench, Hammer, Palette, Zap,
  Globe, Bookmark, Shield, Folder, FileText, Hash,
}
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from './ui/label'
import { useState } from 'react'
import { MultiSelect, Option } from './ui/multi-select'


type TransactionFiltersProps = {
  filters: {
    type: string[] | undefined
    accountId: string[] | undefined
    categoryId: string[] | undefined
    labelId: string[] | undefined
    merchantId: string[] | undefined
    dateRange: DateRange | undefined
  }
  onFilterChange: (filters: TransactionFiltersProps['filters']) => void
  extraAction?: React.ReactNode
}

export default function TransactionFilters({
  filters,
  onFilterChange,
  extraAction,
}: TransactionFiltersProps) {
  const { householdId } = useHousehold()
  const accounts = useQuery(api.accounts.get, { householdId: householdId ?? undefined })
  const categories = useQuery(api.categories.get, { householdId: householdId ?? undefined });
  const labels = useQuery(api.labels.get, { householdId: householdId ?? undefined });
  const merchants = useQuery(api.merchants.get, { householdId: householdId ?? undefined });
  const [open, setOpen] = useState(false);

  const handleDateChange = (dateRange: DateRange | undefined) => {
    onFilterChange({ ...filters, dateRange })
  }

  const activeFiltersCount = (filters.type?.length || 0) + 
                             (filters.accountId?.length || 0) + 
                             (filters.categoryId?.length || 0) + 
                             (filters.labelId?.length || 0) +
                             (filters.merchantId?.length || 0) +
                             (filters.dateRange?.from ? 1 : 0);

  const typeOptions: Option[] = [
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Transfer', value: 'transfer' },
  ];

  const accountOptions: Option[] = accounts?.map(a => ({ label: a.name, value: a._id })) || [];
  const categoryOptions: Option[] = categories?.map(c => ({ label: c.name, value: c._id })) || [];
  const labelOptions: Option[] = labels?.map(l => ({ label: l.name, value: l._id, icon: (ICON_MAP[l.icon] || Tag) as React.ComponentType<{ className?: string }> })) || [];
  const merchantOptions: Option[] = merchants?.map(m => ({ label: m.name, value: m._id })) || [];

  const resetAll = () => onFilterChange({ type: undefined, accountId: undefined, categoryId: undefined, labelId: undefined, merchantId: undefined, dateRange: filters.dateRange });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
            className="w-[var(--radix-popover-content-available-width)] min-w-72 p-4" 
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
                    onClick={resetAll}
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

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Merchant</Label>
                  <MultiSelect
                    options={merchantOptions}
                    selected={filters.merchantId || []}
                    onChange={(val) => onFilterChange({ ...filters, merchantId: val.length > 0 ? val : undefined })}
                    placeholder="All Merchants"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Date Range</Label>
                  <DateRangePicker
                    date={filters.dateRange}
                    setDate={handleDateChange}
                  />
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
        
        {extraAction}
      </div>

      {/* Active Filter Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
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
          {filters.labelId?.map(id => {
            const opt = labelOptions.find(o => o.value === id);
            const LabelIcon = opt?.icon || Tag;
            return (
              <span key={id} className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-1 rounded-md">
                <LabelIcon className="h-3 w-3" />
                {opt?.label || id}
                <button onClick={() => onFilterChange({ ...filters, labelId: filters.labelId?.filter(i => i !== id) })} className="ml-0.5 hover:text-destructive">×</button>
              </span>
            );
          })}
          {filters.merchantId?.map(id => (
            <Badge key={id} variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Merchant: {merchantOptions.find(o => o.value === id)?.label || id}
              <button onClick={() => onFilterChange({ ...filters, merchantId: filters.merchantId?.filter(i => i !== id) })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          {filters.dateRange?.from && (
            <Badge variant="secondary" className="gap-1 rounded-md px-2 py-1">
              Date: {filters.dateRange.from.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              {filters.dateRange.to ? ` – ${filters.dateRange.to.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}
              <button onClick={() => onFilterChange({ ...filters, dateRange: undefined })} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
            </Badge>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-6 text-xs text-muted-foreground hover:text-destructive"
            onClick={resetAll}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
