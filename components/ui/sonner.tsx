"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg data-[type=success]:!bg-success/90 data-[type=success]:!text-success-foreground data-[type=success]:!border-success data-[type=error]:!bg-destructive/90 data-[type=error]:!text-destructive-foreground data-[type=error]:!border-destructive relative after:content-[''] after:absolute after:right-1 after:top-1/2 after:-translate-y-1/2 after:h-8 after:w-1 after:bg-current/20 after:rounded-full",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: 
            "opacity-0 group-hover:opacity-100 transition-opacity !bg-background !border-border !text-foreground hover:!bg-muted",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
