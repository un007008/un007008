"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DealData = {
  id: string;
  dealType: "SALE" | "RENT";
  amount: string;
  status: string;
  contractStart: string | null;
  contractEnd: string | null;
  documents: { id: string; name: string; url: string }[];
};

const DEAL_STATUS_LABEL: Record<string, string> = {
  DRAFT: "ร่าง",
  CONTRACT_SENT: "ส่งสัญญาแล้ว",
  SIGNED: "เซ็นแล้ว",
  COMPLETED: "จบดีล",
  CANCELLED: "ยกเลิก",
};

export function DealSection({
  leadId,
  propertyId,
  defaultDealType,
  deal,
}: {
  leadId: string;
  propertyId: string | null;
  defaultDealType: "SALE" | "RENT";
  deal: DealData | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [dealType, setDealType] = useState<"SALE" | "RENT">(defaultDealType);
  const [amount, setAmount] = useState("");
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function createDeal() {
    if (!propertyId) {
      setError("ต้องระบุทรัพย์ที่สนใจใน Lead ก่อน (แก้ได้จากปุ่มแปลงเป็น Lead หรือฐานข้อมูล)");
      return;
    }
    if (!amount) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/deal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          dealType,
          amount: Number(amount),
          contractStart: dealType === "RENT" ? contractStart || null : null,
          contractEnd: dealType === "RENT" ? contractEnd || null : null,
        }),
      });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "สร้างไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: string) {
    if (!deal) return;
    setBusy(true);
    try {
      await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function upload(files: FileList | null) {
    if (!deal || !files?.length) return;
    setBusy(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch(`/api/deals/${deal.id}/documents`, { method: "POST", body: form });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeDoc(id: string) {
    if (!confirm("ลบเอกสารนี้?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (deal) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {deal.dealType === "SALE" ? "ขาย" : "เช่า"} ·{" "}
            {Number(deal.amount).toLocaleString("th-TH")} บ.
            {deal.dealType === "RENT" && "/เดือน"}
          </p>
          <select
            value={deal.status}
            disabled={busy}
            onChange={(e) => void changeStatus(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {Object.entries(DEAL_STATUS_LABEL).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        {(deal.contractStart || deal.contractEnd) && (
          <p className="text-xs text-muted-foreground">
            สัญญา:{" "}
            {deal.contractStart && new Date(deal.contractStart).toLocaleDateString("th-TH")} —{" "}
            {deal.contractEnd && new Date(deal.contractEnd).toLocaleDateString("th-TH")}
          </p>
        )}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground">
              เอกสาร ({deal.documents.length})
            </p>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              + อัปโหลด
            </Button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
          </div>
          {deal.documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-xs">
              <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-amber-700 hover:underline">
                📄 {d.name}
              </a>
              <button onClick={() => void removeDoc(d.id)} className="shrink-0 text-destructive">
                ลบ
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <div className="space-y-1">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          + สร้าง Deal
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {(["SALE", "RENT"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setDealType(v)}
            className={`rounded-full px-3 py-1 text-xs ${dealType === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
          >
            {v === "SALE" ? "ขาย" : "เช่า"}
          </button>
        ))}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">มูลค่า (บาท{dealType === "RENT" ? "/เดือน" : ""})</Label>
        <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
      </div>
      {dealType === "RENT" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">เริ่มสัญญา</Label>
            <Input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">สิ้นสุดสัญญา</Label>
            <Input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} />
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void createDeal()} disabled={busy || !amount}>
          {busy ? "กำลังสร้าง…" : "สร้าง Deal"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
