"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function LeadForm({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);
  const [interest, setInterest] = useState<"SALE" | "RENT" | "">("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId,
          source: "CHAT",
          interest: interest || null,
          budgetMin: budgetMin ? Number(budgetMin) : null,
          budgetMax: budgetMax ? Number(budgetMax) : null,
          note: note || null,
        }),
      });
      if (res.ok) {
        setDone(true);
        setOpen(false);
      }
    } finally {
      setSaving(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
        สร้าง Lead แล้ว ✓ ดูได้ที่หน้า{" "}
        <a href="/admin/leads" className="underline">
          ลูกค้ามุ่งหวัง
        </a>
      </div>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        ⭐ แปลงเป็น Lead
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-2">
      <p className="text-xs font-semibold">สร้าง Lead จากบทสนทนานี้</p>
      <div className="flex gap-1">
        {(
          [
            { value: "SALE", label: "ซื้อ" },
            { value: "RENT", label: "เช่า" },
          ] as const
        ).map((o) => (
          <button
            key={o.value}
            onClick={() => setInterest(interest === o.value ? "" : o.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs",
              interest === o.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">งบต่ำสุด (บาท)</Label>
          <Input
            inputMode="numeric"
            className="h-8"
            value={budgetMin}
            onChange={(e) => setBudgetMin(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">งบสูงสุด (บาท)</Label>
          <Input
            inputMode="numeric"
            className="h-8"
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, ""))}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">โน้ต</Label>
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={saving}>
          {saving ? "กำลังสร้าง…" : "สร้าง Lead"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}
