"use client"

import * as React from "react"
import { ChevronsUpDown, Plus, Check, Settings, UserPlus } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useHousehold } from "./HouseholdProvider"
import { Logo } from "./Logo"
import { HouseholdSettingsDialog } from "./HouseholdSettingsDialog"
import { JoinHouseholdDialog } from "./JoinHouseholdDialog"

export function HouseholdSwitcher() {
  const { isMobile } = useSidebar()
  const { households, householdId, selectHousehold, createHousehold } = useHousehold()
  
  const [showJoinDialog, setShowJoinDialog] = React.useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = React.useState(false)
  
  const activeHousehold = households.find(h => h._id === householdId)

  return (
    <>
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Logo className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {activeHousehold?.name || "Perfin"}
                </span>
                <span className="truncate text-xs">{activeHousehold ? "Household" : "Finance Tracker"}</span>
              </div>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Households
            </DropdownMenuLabel>
            {households.map((household) => (
              <DropdownMenuItem
                key={household._id}
                onClick={() => selectHousehold(household._id)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Logo className="size-4 shrink-0" />
                </div>
                {household.name}
                {household._id === householdId && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" onClick={() => {
                const name = prompt("Enter new household name:");
                if (name) createHousehold(name);
            }}>
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Create Household</div>
            </DropdownMenuItem>

            <DropdownMenuItem className="gap-2 p-2" onClick={() => setShowJoinDialog(true)}>
               <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <UserPlus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">Join Household</div>
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            
            <DropdownMenuItem className="gap-2 p-2" onClick={() => setShowSettingsDialog(true)}>
               <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                  <Settings className="size-4" />
               </div>
               <div className="font-medium text-muted-foreground">Household Settings</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>

    <JoinHouseholdDialog open={showJoinDialog} onOpenChange={setShowJoinDialog} />
    {householdId && (
        <HouseholdSettingsDialog 
          householdId={householdId} 
          open={showSettingsDialog} 
          onOpenChange={setShowSettingsDialog} 
        />
    )}
    </>
  )
}
