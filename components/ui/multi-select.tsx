"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command" // We need to install command if not present, but usually it is. Shadcn uses cmdk
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

export type Option = {
  label: string
  value: string
  icon?: React.ComponentType<{ className?: string }>
}

interface MultiSelectProps {
  options: Option[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
  className?: string
  badgeClassName?: string
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  className,
  badgeClassName
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleUnselect = (item: string) => {
    onChange(selected.filter((i) => i !== item))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between h-auto min-h-10 px-3 py-2", className)}
        >
          <div className="flex flex-wrap gap-1 items-center w-full">
            {selected.length === 0 && (
                <span className="text-muted-foreground font-normal">{placeholder}</span>
            )}
            
            {selected.length > 0 && selected.length <= 2 ? (
                selected.map((item) => {
                    const option = options.find((o) => o.value === item);
                    return (
                        <Badge
                            variant="secondary"
                            key={item}
                            className={cn("mr-1 mb-1 font-normal", badgeClassName)}
                            onClick={(e) => {
                                e.stopPropagation()
                                handleUnselect(item)
                            }}
                        >
                            {option?.icon && <option.icon className="mr-1 h-3 w-3" />}
                            {option?.label || item}
                            <div
                                className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:bg-destructive hover:text-destructive-foreground"
                                onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleUnselect(item)
                                }
                                }}
                                onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                }}
                                onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                handleUnselect(item)
                                }}
                            >
                                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                            </div>
                        </Badge>
                    )
                })
            ) : selected.length > 2 ? (
                 <Badge variant="secondary" className="mr-1 mb-1">
                    {selected.length} Selected
                 </Badge>
            ) : null}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  onSelect={() => {
                    onChange(
                      selected.includes(option.value)
                        ? selected.filter((item) => item !== option.value)
                        : [...selected, option.value]
                    )
                  }}
                >
                  <div
                    className={cn(
                      "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                      selected.includes(option.value)
                        ? "bg-primary text-primary-foreground"
                        : "opacity-50 [&_svg]:invisible"
                    )}
                  >
                    <Check className={cn("h-4 w-4")} />
                  </div>
                  {option.icon && (
                    <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  )}
                  <span>{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            {selected.length > 0 && (
                <>
                    <CommandSeparator />
                    <CommandGroup>
                        <CommandItem
                            onSelect={() => onChange([])}
                            className="justify-center text-center text-xs"
                        >
                            Clear filters
                        </CommandItem>
                    </CommandGroup>
                </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
