import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  onTogglePrivacy?: () => void;
  isPrivacyMode?: boolean;
}

export function PageHeader({ 
  title, 
  description, 
  action, 
  className,
  onTogglePrivacy,
  isPrivacyMode
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8", className)}>
      <div className="space-y-1">
        <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {title}
            </h1>
            {onTogglePrivacy && (
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onTogglePrivacy}
                    title={isPrivacyMode ? "Show balances" : "Hide balances"}
                >
                    {isPrivacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
            )}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
