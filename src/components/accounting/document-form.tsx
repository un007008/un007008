"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  calcTotals,
  DOC_TYPE_LABEL,
  fmtMoney,
  WHT_RATES,
} from "@/lib/accounting";

type ContactOption = { id: string; name: string; type: string };

type ItemRow = { description: string; quantity: string; unitPrice: string };

export type DocumentFormInitial = {
  id: string;
  docType: string;
  contactId: string;
  issueDate: string; // YYYY-MM-DD (Bangkok)
  dueDate: string; // YYYY-MM-DD or ""
  items: ItemRow[];
  discount: number;
  vatRate: number;
  whtRate: number;
  note: string;
};

const DOC_TYPES = [
  "QUOTATION",
  "INVOICE",
  "RECEIPT",
  "EXPENSE",
  "CREDIT_NOTE",
  "DEBIT_NOTE",
] as const;

const EMPTY_ROW: ItemRow = { description: "", quantity: "1", unitPrice: "" };

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

/** Defaults for a fresh document (e.g. invoice created from a CRM deal). */
export type DocumentFormPrefill = {
  docType?: string;
  contactId?: string;
  items?: ItemRow[];
  note?: string;
  refDocId?: string;
};

export function DocumentForm({
  contacts,
  initial,
  prefill,
  todayBkk,
}: {
  contacts: ContactOption[];
  initial?: DocumentFormInitial;
  prefill?: DocumentFormPrefill;
  todayBkk: string;
}) {
  const router = useRouter();
  const [docType, setDocType] = useState(initial?.docType ?? prefill?.docType ?? "INVOICE");
  const [contactId, setContactId] = useState(initial?.contactId ?? prefill?.contactId ?? "");
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? todayBkk);
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? "");
  const [rows, setRows] = useState<ItemRow[]>(
    initial?.items.length
      ? initial.items
      : prefill?.items?.length
        ? prefill.items
        : [{ ...EMPTY_ROW }]
  );
  const [discount, setDiscount] = useState(String(initial?.discount ?? 0));
  const [vatRate, setVatRate] = useState(String(initial?.vatRate ?? 7));
  const [whtRate, setWhtRate] = useState(String(initial?.whtRate ?? 0));
  const [note, setNote] = useState(initial?.note ?? prefill?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(
    () =>
      calcTotals(
        rows.map((r) => ({
          description: r.description,
          quantity: Number(r.quantity) || 0,
          unitPrice: Number(r.unitPrice) || 0,
        })),
        Number(discount) || 0,
        Number(vatRate) || 0,
        Number(whtRate) || 0
      ),
    [rows, discount, vatRate, whtRate]
  );

  function setRow(i: number, patch: Partial<ItemRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  const valid =
    contactId &&
    issueDate &&
    rows.some((r) => r.description.trim() && (Number(r.quantity) || 0) > 0);

  async function save(issue: boolean) {
    setBusy(true);
    setError(null);
    try {
      const payload = {
        docType,
        contactId,
        issueDate,
        dueDate: dueDate || null,
        items: rows
          .filter((r) => r.description.trim())
          .map((r) => ({
            description: r.description,
            quantity: Number(r.quantity) || 0,
            unitPrice: Number(r.unitPrice) || 0,
          })),
        discount: Number(discount) || 0,
        vatRate: Number(vatRate) || 0,
        whtRate: Number(whtRate) || 0,
        note,
        ...(prefill?.refDocId ? { refDocId: prefill.refDocId } : {}),
      };
      const res = initial
        ? await fetch(`/api/admin/accounting/documents/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "update", ...payload }),
          })
        : await fetch("/api/admin/accounting/documents", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, issue }),
          });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      // editing an existing draft then pressing "issue" = two steps
      if (initial && issue) {
        await fetch(`/api/admin/accounting/documents/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "issue" }),
        });
      }
      router.push(`/admin/accounting/documents/${initial ? initial.id : data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">ประเภทเอกสาร</Label>
          <select
            id="doc-type"
            className={selectCls}
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            disabled={!!initial}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>
                {DOC_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-contact">
            {docType === "EXPENSE" ? "ผู้ขาย/คู่ค้า" : "ลูกค้า"}
          </Label>
          <select
            id="doc-contact"
            className={selectCls}
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">— เลือกผู้ติดต่อ —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            ไม่มีในรายการ? เพิ่มได้ที่หน้า &quot;ผู้ติดต่อ&quot; ก่อน
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-issue-date">วันที่เอกสาร</Label>
          <Input
            id="doc-issue-date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-due-date">ครบกำหนดชำระ (ไม่บังคับ)</Label>
          <Input
            id="doc-due-date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      {/* line items */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">รายการ</p>
        {rows.map((r, i) => (
          <div key={i} className="flex flex-wrap items-end gap-2 border-b pb-2 last:border-b-0">
            <div className="min-w-40 flex-1 space-y-1">
              <Label className="text-xs">รายละเอียด</Label>
              <Input
                value={r.description}
                onChange={(e) => setRow(i, { description: e.target.value })}
                placeholder="เช่น ค่านายหน้าขายคอนโด PS-00001"
              />
            </div>
            <div className="w-20 space-y-1">
              <Label className="text-xs">จำนวน</Label>
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={r.quantity}
                onChange={(e) => setRow(i, { quantity: e.target.value })}
              />
            </div>
            <div className="w-32 space-y-1">
              <Label className="text-xs">ราคา/หน่วย (บาท)</Label>
              <Input
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                value={r.unitPrice}
                onChange={(e) => setRow(i, { unitPrice: e.target.value })}
              />
            </div>
            <div className="w-28 pb-2 text-right text-sm">
              ฿{fmtMoney(totals.lines[i]?.amount ?? 0)}
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
              disabled={rows.length === 1}
            >
              ลบ
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])}
        >
          + เพิ่มรายการ
        </Button>
      </div>

      {/* totals */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="doc-discount">ส่วนลดรวม (บาท)</Label>
            <Input
              id="doc-discount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-vat">ภาษีมูลค่าเพิ่ม (VAT)</Label>
            <select
              id="doc-vat"
              className={selectCls}
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
            >
              <option value="7">7%</option>
              <option value="0">ไม่มี VAT</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-wht">หัก ณ ที่จ่าย</Label>
            <select
              id="doc-wht"
              className={selectCls}
              value={whtRate}
              onChange={(e) => setWhtRate(e.target.value)}
            >
              {WHT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r === 0 ? "ไม่มี" : `${r}%`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="doc-note">หมายเหตุ</Label>
            <Textarea
              id="doc-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1 self-end rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span>รวมเป็นเงิน</span>
            <span>฿{fmtMoney(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>ส่วนลด</span>
            <span>-฿{fmtMoney(Number(discount) || 0)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT {vatRate}%</span>
            <span>฿{fmtMoney(totals.vatAmount)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>ยอดรวมทั้งสิ้น</span>
            <span>฿{fmtMoney(totals.total)}</span>
          </div>
          {Number(whtRate) > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>หัก ณ ที่จ่าย {whtRate}%</span>
                <span>-฿{fmtMoney(totals.whtAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>ยอดชำระสุทธิ</span>
                <span>฿{fmtMoney(totals.netPayable)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void save(true)} disabled={busy || !valid}>
          {initial ? "บันทึกและออกเอกสาร" : "ออกเอกสาร"}
        </Button>
        <Button variant="outline" onClick={() => void save(false)} disabled={busy || !valid}>
          บันทึกร่าง
        </Button>
        <Button variant="ghost" onClick={() => router.back()} disabled={busy}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
