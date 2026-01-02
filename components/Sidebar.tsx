'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Tags, 
  PiggyBank, 
  Hash
} from 'lucide-react'

import {
  Sidebar as SidebarComponent,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'

import { HouseholdSwitcher } from './HouseholdSwitcher'

const links = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/categories', label: 'Categories', icon: Tags },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/labels', label: 'Labels', icon: Hash },
]

export default function Sidebar({ className, hideLogo }: { className?: string, hideLogo?: boolean }) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarComponent className={className}>
      {!hideLogo && (
        <SidebarHeader>
          <HouseholdSwitcher />
        </SidebarHeader>
      )}
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={pathname === link.href}
                    tooltip={link.label}
                  >
                    <Link 
                      href={link.href}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <link.icon />
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
            </SidebarContent>
      
            <SidebarRail />
          </SidebarComponent>
        )
      }
      