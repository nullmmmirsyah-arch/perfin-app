import React from 'react'
import { cn } from '@/lib/utils'

export const Logo = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 100 100"
    fill="none"
    stroke="currentColor"
    strokeWidth="10"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("h-6 w-6", className)}
    {...props}
  >
    {/* Outer Coin/Circle */}
    <circle cx="50" cy="50" r="40" strokeWidth="8" />
    
    {/* Upward Trend Line */}
    <path d="M30 65 L45 50 L55 60 L75 35" strokeWidth="8" />
    
    {/* Arrowhead */}
    <path d="M65 35 H75 V45" strokeWidth="8" />
  </svg>
)
