"use client"

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { useTheme } from 'next-themes'

export function ClerkThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { resolvedTheme } = useTheme()

  return (
    <ClerkProvider
      appearance={{
        baseTheme: resolvedTheme === 'dark' ? dark : undefined,
        variables: {
          colorPrimary: 'hsl(221.2 83.2% 53.3%)',
          fontSize: '0.875rem',
          borderRadius: '0.5rem',
          fontFamily: 'var(--font-sans)',
        },
        elements: {
          card: 'shadow-xl border bg-card text-card-foreground rounded-xl',
          headerTitle: 'text-foreground font-bold',
          headerSubtitle: 'text-muted-foreground',
          navbar: 'hidden md:flex border-r border-border bg-muted/20',
          navbarButton: 'text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md',
          navbarMobileMenuButton: 'text-foreground',
          navbarMobileMenuRow: 'text-foreground hover:bg-muted/50',
          
          // Form elements
          formFieldLabel: 'text-foreground font-medium',
          formFieldInput: 'bg-background border-input text-foreground focus:ring-ring focus:border-ring rounded-md',
          formButtonPrimary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-md',
          formButtonReset: 'text-foreground hover:bg-muted rounded-md',
          
          // Footer
          footer: 'bg-muted/20 border-t border-border',
          footerActionLink: 'text-primary hover:text-primary/90 font-medium',
          
          // User Button specific
          userButtonPopoverCard: 'shadow-md border border-border bg-popover text-popover-foreground rounded-lg p-0',
          userButtonPopoverActions: 'p-1',
          userButtonPopoverActionButton: 'hover:bg-accent hover:text-accent-foreground rounded-sm px-2 py-1.5 text-sm',
          userButtonPopoverFooter: 'hidden',
          
          // General
          dividerLine: 'bg-border',
          dividerText: 'text-muted-foreground',
          scrollBox: 'bg-card',
          
          // Profile Page specific
          profileSectionTitle: 'text-foreground font-semibold border-b border-border pb-2',
          profileSectionPrimaryButton: 'text-primary hover:bg-primary/10',
          profileSectionTitleText: 'text-foreground',
          accordionTriggerButton: 'text-foreground hover:text-foreground/80',
          badge: 'bg-primary/20 text-primary border border-primary/30',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
