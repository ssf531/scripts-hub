// Types

export interface ColumnDef {
  name: string;
  xMin: number;
  xMax: number;
}

export interface ColumnLayout {
  columns: ColumnDef[];
  pageWidth: number;
  headerRowY?: number;
}

export interface BankTransaction {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  sourceFile: string;
}

export interface PreviewWord {
  text: string;
  columnName: string;
  color: string;
}

export interface PreviewRow {
  words: PreviewWord[];
}

export interface ParsedFile {
  filename: string;
  transactions: BankTransaction[];
  rawText: string;
  layout: ColumnLayout;
}

export interface ValidationResult {
  report: string;
}

// API functions

export async function detectLayout(file: File): Promise<ColumnLayout> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/pdf-parser/detect-layout", { method: "POST", body: form });
  if (!res.ok) throw new Error(`detect-layout failed: ${await res.text()}`);
  return res.json();
}

export async function previewLayout(file: File, layout: ColumnLayout): Promise<PreviewRow[]> {
  const form = new FormData();
  form.append("file", file);
  form.append("layout", JSON.stringify(layout));
  const res = await fetch("/api/pdf-parser/preview-layout", { method: "POST", body: form });
  if (!res.ok) throw new Error(`preview-layout failed: ${await res.text()}`);
  return res.json();
}

export async function parsePdfs(files: File[], layout: ColumnLayout): Promise<ParsedFile[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  form.append("layout", JSON.stringify(layout));
  const res = await fetch("/api/pdf-parser/parse", { method: "POST", body: form });
  if (!res.ok) throw new Error(`parse failed: ${await res.text()}`);
  return res.json();
}

export async function validateTransactions(
  transactions: BankTransaction[],
  rawText: string,
  model: string,
): Promise<ValidationResult> {
  const res = await fetch("/api/pdf-parser/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions, rawText, model }),
  });
  if (!res.ok) throw new Error(`validate failed: ${await res.text()}`);
  return res.json();
}

export async function exportCsv(
  transactions: BankTransaction[],
  columns?: string[],
): Promise<void> {
  const res = await fetch("/api/pdf-parser/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactions, columns }),
  });
  if (!res.ok) throw new Error(`export failed: ${await res.text()}`);
  const blob = await res.blob();
  triggerDownload(blob, "transactions.csv");
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
