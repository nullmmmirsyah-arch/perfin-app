'use client'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'

export default function Header() {
  return (
    <header className="flex items-center justify-between p-4 border-b lg:hidden">
      <h1 className="text-xl font-bold">Perfin</h1>
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-6 w-6" />
          </Button>
        </SheetTrigger>
                  <SheetContent side="left" className="p-0">
                    <SheetHeader>
                      <SheetTitle className="sr-only">Navigation</SheetTitle>
                    </SheetHeader>
                    <Sidebar />
                  </SheetContent>      </Sheet>
    </header>
  )
}
