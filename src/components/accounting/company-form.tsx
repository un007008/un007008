"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Company = {
  name: string;
  taxId: string;
  branch: string;
  address: string;
  phone: string;
  email: string;
};

const EMPTY: Company = { name: "", taxId: "", branch: "", address: "", phone: "", email: "" };

export function CompanyForm() {
  const [form, setForm] = useState<Company>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/accounting/company");
    if (res.ok) setForm(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/accounting/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaved(true);
      else alert("บันทึกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="co-name">ชื่อบริษัท/กิจการ</Label>
          <Input
            id="co-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="เช่น บจก. บางกอกไพร์มพร็อพเพอร์ตี้"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-taxid">เลขผู้เสียภาษี</Label>
          <Input
            id="co-taxid"
            value={form.taxId}
            onChange={(e) => setForm({ ...form, taxId: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-branch">สาขา</Label>
          <Input
            id="co-branch"
            value={form.branch}
            onChange={(e) => setForm({ ...form, branch: e.target.value })}
            placeholder="เช่น สำนักงานใหญ่"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="co-phone">โทรศัพท์</Label>
          <Input
            id="co-phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="co-email">อีเมล</Label>
          <Input
            id="co-email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="co-address">ที่อยู่ (แสดงบนหัวเอกสาร)</Label>
        <Textarea
          id="co-address"
          rows={2}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={() => void save()} disabled={busy}>
          บันทึก
        </Button>
        {saved && <span className="text-sm text-emerald-700">บันทึกแล้ว ✓</span>}
      </div>
    </div>
  );
}
