"use client"

import { CalendarDays } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { MobileInputCard, MobileSelectionDrawer } from "@/components/ui/mobile-inputs"

interface MobileDatePickerProps {
  date?: Date
  setDate: (date?: Date) => void
  disabled?: (date: Date) => boolean
}

export function MobileDatePicker({
  date,
  setDate,
  disabled,
}: MobileDatePickerProps) {
  return (
    <MobileSelectionDrawer
      title="Select Date"
      trigger={
        <button type="button" className="w-full text-left outline-none">
          <MobileInputCard
            label="Date"
            icon={CalendarDays}
            valueDisplay={
              date
                ? date.toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                  })
                : "Pick"
            }
          />
        </button>
      }
    >
      {({ close }) => (
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            if (d) {
              setDate(d)
              close()
            }
          }}
          disabled={disabled}
          initialFocus
        />
      )}
    </MobileSelectionDrawer>
  )
}
