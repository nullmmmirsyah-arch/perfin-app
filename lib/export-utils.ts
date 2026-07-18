type ExportTransaction = {
  date: string;
  type: string;
  amount: string;
  account: string;
  toAccount: string;
  category: string;
  labels: string[];
  description: string;
  isSplit?: boolean;
  assetQuantity?: string;
};

export function convertTransactionsToCSV(transactions: ExportTransaction[]): string {
  if (!transactions || transactions.length === 0) {
    return "";
  }

  // 1. Define Columns
  const headers = [
    "Date",
    "Type",
    "Amount",
    "Account",
    "To Account",
    "Category",
    "Labels",
    "Description",
    "Asset Quantity"
  ];

  // 2. Map Data to Rows
  const rows = transactions.map(t => {
    // Sanitize fields to prevent CSV breakage (escape quotes)
    const escape = (val: string) => {
        if (!val) return "";
        const str = String(val);
        // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    return [
        escape(t.date.split('T')[0]), // YYYY-MM-DD
        escape(t.type.toUpperCase()),
        escape(t.amount),
        escape(t.account),
        escape(t.toAccount),
        escape(t.category),
        escape(t.labels?.join(', ') || ""),
        escape(t.description),
        escape(t.assetQuantity || "")
    ].join(",");
  });

  // 3. Join Header + Rows
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCSV(csvContent: string, filename: string = "transactions.csv") {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}
