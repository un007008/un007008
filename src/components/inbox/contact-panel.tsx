"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ConversationSummary } from "./types";

export function ContactPanel({
  contact,
  onSaved,
}: {
  contact: ConversationSummary["contact"];
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: contact.name ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    note: contact.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setForm({
      name: contact.name ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      note: contact.note ?? "",
    });
  }, [contact.id, contact.name, contact.phone, contact.email, contact.note]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSavedAt(Date.now());
        onSaved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3">
      <h3 className="text-sm font-semibold">ข้อมูลลูกค้า</h3>
      <div className="space-y-1.5">
        <Label htmlFor="c-name">ชื่อ</Label>
        <Input
          id="c-name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-phone">เบอร์โทร</Label>
        <Input
          id="c-phone"
          inputMode="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-email">อีเมล</Label>
        <Input
          id="c-email"
          inputMode="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="c-note">โน้ต</Label>
        <Textarea
          id="c-note"
          rows={4}
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
      </div>
      {contact.lineUserId && (
        <p className="break-all text-xs text-muted-foreground">
          LINE: {contact.lineUserId}
        </p>
      )}
      <Button size="sm" onClick={() => void save()} disabled={saving}>
        {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
      </Button>
      {savedAt && <p className="text-xs text-emerald-600">บันทึกแล้ว ✓</p>}
    </div>
  );
}
