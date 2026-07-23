"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CONTACT_TYPE_LABEL } from "@/lib/accounting";

type AccContact = {
  id: string;
  type: "CUSTOMER" | "VENDOR" | "BOTH";
  name: string;
  taxId: string | null;
  branch: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  note: string | null;
  _count: { documents: number };
};

const EMPTY = {
  name: "",
  type: "CUSTOMER",
  taxId: "",
  branch: "",
  address: "",
  phone: "",
  email: "",
  note: "",
};

const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm";

export function AccContactsClient() {
  const [contacts, setContacts] = useState<AccContact[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/accounting/contacts");
    if (res.ok) setContacts(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = editingId
        ? await fetch(`/api/admin/accounting/contacts/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          })
        : await fetch("/api/admin/accounting/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
          });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: AccContact) {
    if (!confirm(`ลบผู้ติดต่อ "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/accounting/contacts/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "ลบไม่สำเร็จ");
      return;
    }
    if (editingId === c.id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    await load();
  }

  function startEdit(c: AccContact) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      type: c.type,
      taxId: c.taxId ?? "",
      branch: c.branch ?? "",
      address: c.address ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      note: c.note ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* add / edit form */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">
          {editingId ? "แก้ไขผู้ติดต่อ" : "เพิ่มผู้ติดต่อใหม่"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ac-name">ชื่อ (บุคคล/บริษัท)</Label>
            <Input
              id="ac-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น บจก. สมาร์ทโฮม จำกัด"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-type">ประเภท</Label>
            <select
              id="ac-type"
              className={selectCls}
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="CUSTOMER">ลูกค้า</option>
              <option value="VENDOR">ผู้ขาย/คู่ค้า</option>
              <option value="BOTH">ลูกค้าและผู้ขาย</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-taxid">เลขผู้เสียภาษี (ไม่บังคับ)</Label>
            <Input
              id="ac-taxid"
              value={form.taxId}
              onChange={(e) => setForm({ ...form, taxId: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-branch">สาขา (ไม่บังคับ)</Label>
            <Input
              id="ac-branch"
              value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })}
              placeholder="เช่น สำนักงานใหญ่"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-phone">โทรศัพท์</Label>
            <Input
              id="ac-phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ac-email">อีเมล</Label>
            <Input
              id="ac-email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ac-address">ที่อยู่ (แสดงบนเอกสาร)</Label>
          <Textarea
            id="ac-address"
            rows={2}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ac-note">โน้ตภายใน</Label>
          <Input
            id="ac-note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void submit()} disabled={busy || !form.name.trim()}>
            {editingId ? "บันทึกการแก้ไข" : "เพิ่มผู้ติดต่อ"}
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY);
              }}
            >
              ยกเลิก
            </Button>
          )}
        </div>
      </div>

      {/* list */}
      <div className="space-y-2">
        {contacts.map((c) => (
          <div key={c.id} className="space-y-1 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{c.name}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="outline">{CONTACT_TYPE_LABEL[c.type]}</Badge>
                <Badge variant="secondary">{c._count.documents} เอกสาร</Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {[
                c.taxId && `เลขผู้เสียภาษี ${c.taxId}${c.branch ? ` (${c.branch})` : ""}`,
                c.phone,
                c.email,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
            {c.address && <p className="text-xs text-muted-foreground">{c.address}</p>}
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                แก้ไข
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => void remove(c)}
                disabled={c._count.documents > 0}
              >
                ลบ
              </Button>
            </div>
          </div>
        ))}
        {contacts.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีผู้ติดต่อ — เพิ่มรายชื่อแรกจากฟอร์มด้านบน
          </p>
        )}
      </div>
    </div>
  );
}
