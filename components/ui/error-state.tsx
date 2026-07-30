import { AlertCircle, RefreshCw } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import type { LucideIcon } from '@/components/ui/icons'

interface ErrorStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  secondaryAction?: { label: string; href?: string; onClick?: () => void }
}

export function ErrorState({ icon: Icon = AlertCircle, title, description, action, secondaryAction }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-[240px]">{description}</p>
      )}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-1">
          {action && (
            <Button variant="outline" size="sm" onClick={action.onClick} className="gap-2">
              <RefreshCw className="h-3 w-3" />
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            secondaryAction.href ? (
              <Button variant="ghost" size="sm" asChild>
                <a href={secondaryAction.href}>{secondaryAction.label}</a>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}
