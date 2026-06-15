'use client'

import { Authenticated, Unauthenticated, AuthLoading } from 'convex/react'
import Sidebar from './Sidebar'
import { ReactNode, useState, useEffect, useCallback } from 'react'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Plus, Bell, LogOut, Settings } from 'lucide-react'
import TransactionDrawer from './TransactionDrawer'
import { SettingsSheet } from './SettingsSheet'
import { UserButton, useClerk } from '@clerk/nextjs'
import { ThemeToggle } from './ThemeToggle'
import { PushNotificationSettings } from './PushNotificationSettings'
import { BottomNav } from './BottomNav'
import { HouseholdSwitcher } from './HouseholdSwitcher'

import LandingPage from './LandingPage'
import { HouseholdProvider } from './HouseholdProvider'
import NotificationBell from './NotificationBell'
import { LoadingScreen } from './LoadingScreen'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function LayoutWrapper({ children }: { children: ReactNode }) {
  const [isTransactionOpen, setIsTransactionOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const { signOut } = useClerk()

  // --- LOGOUT CONFIRMATION LOGIC ---
  
  // Sentinel State Initialization
  const initSentinel = useCallback(() => {
    // Only push if we aren't already in a sentinel state to avoid duplicates
    if (window.history.state?.perfinEntry) return;

    // Root is the "Warning Zone"
    window.history.replaceState({ perfinRoot: true }, '');
    // Entry is the "Safe Zone" where the app lives
    window.history.pushState({ perfinEntry: true }, '');
  }, []);

  useEffect(() => {
    // We only want this logic to run for authenticated users
    // Since we don't have easy access to Convex Auth state here without hooks,
    // we rely on the fact that this component renders child components that
    // only mount when authenticated. However, for the history API, 
    // we can check if we are on the client.
    
    const handlePopState = (event: PopStateEvent) => {
      // If user pops back into the Root state, it means they are about to leave the app
      if (event.state?.perfinRoot) {
        setShowLogoutDialog(true);
        // Push state back to Entry to prevent the actual "Back" from happening
        // and keep the user on the root sentinel for the next attempt.
        window.history.pushState({ perfinEntry: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleStay = () => {
    setShowLogoutDialog(false);
  };

  const handleLogout = async () => {
    setShowLogoutDialog(false);
    await signOut();
    window.location.href = '/'; // Ensure clean redirect to landing
  };

  return (
    <>
      <AuthLoading>
        <LoadingScreen />
      </AuthLoading>
      <Authenticated>
        <HouseholdProvider>
          <InitHistorySentinel onInit={initSentinel} />
          <SidebarProvider>
            <div className="hidden md:block h-full">
                <Sidebar />
            </div>
            
            <SidebarInset className="pb-20 md:pb-0">
            <header className="sticky top-0 z-10 bg-background flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[[collapsible=icon]]/sidebar-wrapper:h-12 px-4">
               <div className="hidden md:flex items-center gap-2">
                   <SidebarTrigger className="-ml-1" />
                   <Separator orientation="vertical" className="mr-2 h-4" />
                   <h1 className="text-4x1 text-shadow-xs font-bold text-primary uppercase">Personal Finance</h1>
               </div>
               
               <div className="md:hidden">
                  <HouseholdSwitcher mode="mobile" />
               </div>

               <div className="ml-auto flex items-center gap-4">
                 <Button 
                   onClick={() => setIsTransactionOpen(true)}
                   size="sm"
                   className="hidden lg:flex items-center gap-2"
                 >
                   <Plus className="h-4 w-4" /> Add Transaction
                 </Button>
                 <Button
                   variant="ghost"
                   size="icon"
                   className="h-8 w-8 text-muted-foreground hover:text-foreground md:hidden"
                   onClick={() => setSettingsOpen(true)}
                   title="Settings"
                 >
                   <Settings className="h-4 w-4" />
                 </Button>
                 <NotificationBell />
                 <ThemeToggle />
                 <UserButton>
                   <UserButton.UserProfilePage 
                     label="Push Settings" 
                     labelIcon={<Bell className="h-4 w-4" />}
                     url="push-settings"
                   >
                     <PushNotificationSettings />
                   </UserButton.UserProfilePage>
                 </UserButton>
               </div>
            </header>
            <main className="flex-1 p-4 lg:p-8">
               {children}
            </main>
          </SidebarInset>
          
            
          
            <TransactionDrawer open={isTransactionOpen} onOpenChange={setIsTransactionOpen} />
            <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
            <BottomNav />
          
          </SidebarProvider>

          {/* EXIT CONFIRMATION DIALOG */}
          <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <LogOut className="h-5 w-5 text-destructive" />
                  Keluar dari Perfin?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Anda akan keluar dari aplikasi dan akun Anda akan di-logout demi keamanan. Ingin melanjutkan?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleStay}>Tidak, Tetap Disini</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleLogout}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Ya, Logout & Keluar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          
        </HouseholdProvider>
          
      </Authenticated>
          
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
    </>
  )
}

/**
 * Small helper component to initialize the history sentinel only when 
 * the user is actually Authenticated and the main app is mounted.
 */
function InitHistorySentinel({ onInit }: { onInit: () => void }) {
  useEffect(() => {
    onInit();
  }, [onInit]);
  return null;
}