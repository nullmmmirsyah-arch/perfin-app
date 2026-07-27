"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from '@/components/ui/icons'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerProps {
  date?: Date
  setDate: (date?: Date) => void
  placeholder?: string
  className?: string
  disabled?: (date: Date) => boolean
  fromDate?: Date
  toDate?: Date
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years"
  showOutsideDays?: boolean
}

export function DatePicker({
  date,
  setDate,
  placeholder = "Pick a date",
  className,
  disabled,
  fromDate,
  toDate,
  captionLayout = "dropdown",
  showOutsideDays = true,
}: DatePickerProps) {
  // Default year range for dropdown: 1900 to Current Year + 10 (or configurable via props effectively)
  // react-day-picker uses fromYear/toYear for dropdown generation.
  // We infer reasonable defaults if not strictly provided via props, 
  // but to match the "Goal Drawer" feel, we need explicit years.
  
  const currentYear = new Date().getFullYear();
  const defaultFromYear = 1900;
  const defaultToYear = currentYear + 10;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          disabled={disabled}
          initialFocus
          captionLayout={captionLayout}
          fromYear={fromDate ? fromDate.getFullYear() : defaultFromYear}
          toYear={toDate ? toDate.getFullYear() : defaultToYear}
          showOutsideDays={showOutsideDays}
        />
      </PopoverContent>
    </Popover>
  )
}
