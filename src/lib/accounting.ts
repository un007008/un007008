import type { AccDocStatus, AccDocType, AccContactType } from "@prisma/client";

export const DOC_TYPE_LABEL: Record<AccDocType, string> = {
  QUOTATION: "ใบเสนอราคา",
  INVOICE: "ใบแจ้งหนี้",
  RECEIPT: "ใบเสร็จรับเงิน",
  EXPENSE: "บันทึกค่าใช้จ่าย",
  CREDIT_NOTE: "ใบลดหนี้",
  DEBIT_NOTE: "ใบเพิ่มหนี้",
};

export const DOC_TYPE_PREFIX: Record<AccDocType, string> = {
  QUOTATION: "QT",
  INVOICE: "INV",
  RECEIPT: "RC",
  EXPENSE: "EXP",
  CREDIT_NOTE: "CN",
  DEBIT_NOTE: "DN",
};

/**
 * Sign of a document on the income side of reports:
 * +1 for invoices / standalone receipts / debit notes, -1 for credit notes,
 * 0 for everything else (expenses are tracked separately; receipts issued
 * from an invoice are excluded to avoid double counting).
 */
export function incomeSign(doc: { docType: AccDocType; refDocId: string | null }): number {
  if (doc.docType === "INVOICE") return 1;
  if (doc.docType === "RECEIPT") return doc.refDocId ? 0 : 1;
  if (doc.docType === "DEBIT_NOTE") return 1;
  if (doc.docType === "CREDIT_NOTE") return -1;
  return 0;
}

export const DOC_STATUS_LABEL: Record<AccDocStatus, string> = {
  DRAFT: "ร่าง",
  AWAITING_PAYMENT: "รอชำระ",
  PAID: "ชำระแล้ว",
  VOID: "ยกเลิก",
};

export const CONTACT_TYPE_LABEL: Record<AccContactType, string> = {
  CUSTOMER: "ลูกค้า",
  VENDOR: "ผู้ขาย/คู่ค้า",
  BOTH: "ลูกค้าและผู้ขาย",
};

export const PAYMENT_METHODS = ["โอนเงิน", "เงินสด", "เช็ค", "บัตรเครดิต"] as const;

/** Withholding tax rates commonly used in Thailand (percent). */
export const WHT_RATES = [0, 1, 2, 3, 5] as const;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type DocItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

/**
 * Compute document totals the same way on client (live preview) and
 * server (authoritative values stored in DB).
 */
export function calcTotals(
  items: DocItemInput[],
  discount: number,
  vatRate: number,
  whtRate: number
) {
  const lines = items.map((it) => ({
    ...it,
    amount: round2(it.quantity * it.unitPrice),
  }));
  const subtotal = round2(lines.reduce((s, it) => s + it.amount, 0));
  const base = round2(subtotal - discount);
  const vatAmount = round2((base * vatRate) / 100);
  const whtAmount = round2((base * whtRate) / 100);
  const total = round2(base + vatAmount);
  const netPayable = round2(total - whtAmount);
  return { lines, subtotal, vatAmount, whtAmount, total, netPayable };
}

export function fmtMoney(n: number): string {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
