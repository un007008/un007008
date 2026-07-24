"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PAYMENT_METHODS } from "@/lib/accounting";

type DocInfo = {
  id: string;
  docType: string;
  docNumber: string;
  status: string;
};

export function DocumentActions({ doc }: { doc: DocInfo }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [paidAt, setPaidAt] = useState("");
  const [createReceipt, setCreateReceipt] = useState(true);

  async function act(body: Record<string, unknown>, confirmMsg?: string) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/accounting/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "ทำรายการไม่สำเร็จ");
        return;
      }
      setPayOpen(false);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/accounting/documents/${doc.id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "ทำซ้ำไม่สำเร็จ");
        return;
      }
      router.push(`/admin/accounting/documents/${data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`ลบเอกสารร่าง ${doc.docNumber}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/accounting/documents/${doc.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "ลบไม่สำเร็จ");
        return;
      }
      router.push("/admin/accounting/documents");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-1.5">
        {doc.status === "DRAFT" && (
          <>
            <Button size="sm" onClick={() => void act({ action: "issue" })} disabled={busy}>
              ออกเอกสาร
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/accounting/documents/${doc.id}/edit`}>แก้ไข</Link>
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void remove()} disabled={busy}>
              ลบร่าง
            </Button>
          </>
        )}
        {doc.status === "AWAITING_PAYMENT" &&
          (doc.docType === "QUOTATION" ? (
            <Button
              size="sm"
              onClick={() =>
                void act(
                  { action: "markPaid" },
                  `บันทึกว่าลูกค้าตอบรับใบเสนอราคา ${doc.docNumber}?`
                )
              }
              disabled={busy}
            >
              ลูกค้าตอบรับ
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPayOpen((o) => !o)} disabled={busy}>
              บันทึกการชำระ
            </Button>
          ))}
        {doc.status !== "VOID" && doc.status !== "DRAFT" && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              void act(
                { action: "void" },
                `ยกเลิกเอกสาร ${doc.docNumber}? การยกเลิกไม่สามารถย้อนกลับได้`
              )
            }
            disabled={busy}
          >
            ยกเลิกเอกสาร
          </Button>
        )}
        {doc.docType === "QUOTATION" && doc.status !== "DRAFT" && doc.status !== "VOID" && (
          <Button size="sm" asChild>
            <Link href={`/admin/accounting/documents/new?refDoc=${doc.id}&docType=INVOICE`}>
              แปลงเป็นใบแจ้งหนี้
            </Link>
          </Button>
        )}
        {doc.docType === "INVOICE" &&
          (doc.status === "AWAITING_PAYMENT" || doc.status === "PAID") && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={`/admin/accounting/documents/new?refDoc=${doc.id}&docType=CREDIT_NOTE`}
                >
                  ออกใบลดหนี้
                </Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link
                  href={`/admin/accounting/documents/new?refDoc=${doc.id}&docType=DEBIT_NOTE`}
                >
                  ออกใบเพิ่มหนี้
                </Link>
              </Button>
            </>
          )}
        <Button size="sm" variant="outline" onClick={() => void duplicate()} disabled={busy}>
          ทำซ้ำ
        </Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          พิมพ์ / PDF
        </Button>
      </div>

      {payOpen && (
        <div className="w-full space-y-2 rounded-lg border p-3 text-left sm:w-80">
          <p className="text-sm font-semibold">บันทึกการชำระเงิน</p>
          <div className="space-y-1.5">
            <Label htmlFor="pay-method">ช่องทาง</Label>
            <select
              id="pay-method"
              className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {PAYMENT_METHODS.map((mtd) => (
                <option key={mtd} value={mtd}>
                  {mtd}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pay-date">วันที่ชำระ (เว้นว่าง = วันนี้)</Label>
            <Input
              id="pay-date"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>
          {doc.docType === "INVOICE" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createReceipt}
                onChange={(e) => setCreateReceipt(e.target.checked)}
              />
              ออกใบเสร็จรับเงินอัตโนมัติ
            </label>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() =>
                void act({
                  action: "markPaid",
                  paymentMethod,
                  ...(paidAt ? { paidAt } : {}),
                  createReceipt: doc.docType === "INVOICE" ? createReceipt : false,
                })
              }
              disabled={busy}
            >
              ยืนยันการชำระ
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPayOpen(false)} disabled={busy}>
              ยกเลิก
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
