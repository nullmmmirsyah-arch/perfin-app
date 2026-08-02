'use client'

import { SignInButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/Logo'
import { PieChart, TrendingUp, ShieldCheck } from '@/components/ui/icons'
import { ThemeToggle } from './ThemeToggle'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center justify-between sticky top-0 bg-background z-50 shadow-sm">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <Logo className="h-8 w-8" />
          <span>Perfin</span>
        </div>
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <SignInButton mode="modal">
            <Button variant="ghost">Sign In</Button>
          </SignInButton>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-24 px-6 text-center space-y-8 max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-primary">
            Master Your Money <br className="hidden md:inline" />
            <span className="text-foreground">Simplify Your Life</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Perfin helps you track expenses, set budgets, and gain insights into your financial health. 
            All in one secure, intuitive place.
          </p>
          <div className="flex justify-center gap-4">
            <SignInButton mode="modal">
              <Button size="lg" className="px-8 text-lg font-semibold">
                Get Started
              </Button>
            </SignInButton>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/50 px-6">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-center mb-12">Everything you need to grow your wealth</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="bg-card border-border">
                <CardHeader>
                  <TrendingUp className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Expense Tracking</CardTitle>
                  <CardDescription>
                    Effortlessly log transactions and categorize them to see exactly where your money goes.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Smart categorization</li>
                    <li>Recurring transactions</li>
                    <li>Receipt attachments</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <PieChart className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Smart Budgeting</CardTitle>
                  <CardDescription>
                    Set monthly limits for different categories and get notified before you overspend.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Visual progress bars</li>
                    <li>Custom budget periods</li>
                    <li>Rollover budgets</li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader>
                  <ShieldCheck className="h-10 w-10 text-primary mb-2" />
                  <CardTitle>Secure & Private</CardTitle>
                  <CardDescription>
                    Your financial data is encrypted and secure. We prioritize your privacy above all else.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>Bank-grade encryption</li>
                    <li>Private by default</li>
                    <li>Export your data anytime</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-6 bg-background text-center text-muted-foreground text-sm">
        <div className="flex justify-center items-center gap-2 mb-4">
          <Logo className="h-5 w-5" />
          <span className="font-semibold text-foreground">Perfin</span>
        </div>
        <p>&copy; {new Date().getFullYear()} Perfin. All rights reserved.</p>
      </footer>
    </div>
  )
}
