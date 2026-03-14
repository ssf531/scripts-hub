// Types

export interface CsvRow {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  sourceFile: string;
}

export interface TransactionGroup {
  normalisedName: string;
  displayName: string;
  count: number;
  totalDebit: number;
  totalCredit: number;
  rows: CsvRow[];
}

export interface CategoryAssignment {
  group: string;
  category: string;
  confidence: string;
}

export interface GroupResult {
  rows: CsvRow[];
  groups: TransactionGroup[];
}

export interface CategoriseResult {
  categories: CategoryAssignment[];
  rawResponse: string;
}

// API functions

export async function groupCsvs(
  files: File[],
  dateFrom?: string,
  dateTo?: string,
): Promise<GroupResult> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  if (dateFrom) form.append("dateFrom", dateFrom);
  if (dateTo) form.append("dateTo", dateTo);

  const res = await fetch("/api/spending-analysis/group", { method: "POST", body: form });
  if (!res.ok) throw new Error(`group failed: ${await res.text()}`);
  return res.json();
}

export async function exportExcel(
  rows: CsvRow[],
  groups: TransactionGroup[],
): Promise<void> {
  const res = await fetch("/api/spending-analysis/export-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows, groups }),
  });
  if (!res.ok) throw new Error(`export-excel failed: ${await res.text()}`);
  const blob = await res.blob();
  const dateTag = new Date().toISOString().slice(0, 7);
  triggerDownload(blob, `spending_${dateTag}.xlsx`);
}

export async function categorise(
  groups: TransactionGroup[],
  model: string,
): Promise<CategoriseResult> {
  const res = await fetch("/api/spending-analysis/categorise", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ groups, model }),
  });
  if (!res.ok) throw new Error(`categorise failed: ${await res.text()}`);
  return res.json();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
