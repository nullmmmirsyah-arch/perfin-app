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

export function HouseholdSwitcher({ mode = 'sidebar' }: { mode?: 'sidebar' | 'mobile' }) {
  const { isMobile } = useSidebar()
  const { households, householdId, selectHousehold, createHousehold } = useHousehold()
  
  const [showJoinDialog, setShowJoinDialog] = React.useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = React.useState(false)
  
  const activeHousehold = households.find(h => h._id === householdId)

  if (mode === 'mobile') {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-3 focus:outline-none text-left group">
             <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-active:scale-95">
                <Logo className="size-4" />
             </div>
             <div className="flex flex-col leading-tight">
                <span className="truncate max-w-[150px] font-bold text-lg text-primary leading-none mb-0.5">
                    {activeHousehold?.name || "Perfin"}
                </span>
                <span className="text-[10px] text-muted-foreground font-semibold tracking-[0.05em]">
                    {activeHousehold ? "Household" : "Finance Tracker"}
                </span>
             </div>
             <ChevronsUpDown className="size-4 text-muted-foreground ml-0.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px] mt-2">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Households</DropdownMenuLabel>
            {households.map((household) => (
              <DropdownMenuItem key={household._id} onClick={() => selectHousehold(household._id)}>
                {household.name}
                {household._id === householdId && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
                const name = prompt("Enter new household name:");
                if (name) createHousehold(name);
            }}>
              <Plus className="mr-2 h-4 w-4" /> Create Household
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowJoinDialog(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Join Household
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowSettingsDialog(true)}>
              <Settings className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
