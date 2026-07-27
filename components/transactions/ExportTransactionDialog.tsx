import { useState } from "react"
import { useQuery, useConvex } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Download, Loader2, FileSpreadsheet } from '@/components/ui/icons'
import { format } from "date-fns"
import { convertTransactionsToCSV, downloadCSV } from "@/lib/export-utils"
import { toast } from "sonner"
import { useHousehold } from "@/components/HouseholdProvider"
import { DateRange } from "react-day-picker"

type ExportDialogProps = {
    currentFilters: {
        type?: string[];
        accountId?: string[];
        categoryId?: string[];
        labelId?: string[];
        merchantId?: string[];
        search?: string;
        dateRange: DateRange | undefined;
    }
}

export function ExportTransactionDialog({ currentFilters }: ExportDialogProps) {
  const [open, setOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  
  const { householdId } = useHousehold()
  const convex = useConvex();

  const handleExport = async () => {
    setIsExporting(true);
    try {
        // 1. Fetch Data using current active filters
        const data = await convex.query(api.transactions.exportTransactions, {
            householdId: householdId ?? undefined,
            type: currentFilters.type,
            accountId: currentFilters.accountId,
            categoryId: currentFilters.categoryId,
            labelId: currentFilters.labelId,
            merchantId: currentFilters.merchantId,
            search: currentFilters.search,
            dateRange: currentFilters.dateRange ? {
                start: currentFilters.dateRange.from?.toISOString(),
                end: currentFilters.dateRange.to ? (() => {
                    const d = new Date(currentFilters.dateRange.to);
                    d.setHours(23, 59, 59, 999);
                    return d.toISOString();
                })() : currentFilters.dateRange.from?.toISOString()
            } : undefined,
        });

        if (!data || data.length === 0) {
            toast.error("No transactions found for the current filters.");
            setIsExporting(false);
            return;
        }

        // 2. Generate CSV
        const csv = convertTransactionsToCSV(data);
        
        // 3. Download
        const now = new Date();
        const filename = `perfin_export_${format(now, 'yyyyMMdd_HHmm')}.csv`;
        downloadCSV(csv, filename);

        toast.success(`Exported ${data.length} transactions successfully!`);
        setOpen(false);

    } catch (error) {
        console.error("Export failed:", error);
        toast.error("Failed to export transactions.");
    } finally {
        setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 px-3">
          <Download className="h-4 w-4" />
          <span className="whitespace-nowrap">
            Export
          </span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Export</DialogTitle>
          <DialogDescription>
            This will download all transactions matching your current active filters as a CSV file.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <div className="text-xs text-muted-foreground bg-muted p-4 rounded-lg space-y-2">
             <div className="flex items-center gap-2 font-semibold text-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Export Summary</span>
             </div>
             <ul className="space-y-1 list-disc list-inside opacity-80">
                <li>Respects Date Range selection</li>
                <li>Respects Category, Account, & Type filters</li>
                <li>Includes detailed split transaction data</li>
             </ul>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="gap-2">
            {isExporting ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparing File...
                </>
            ) : (
                <>
                    <Download className="h-4 w-4" />
                    Download CSV
                </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

