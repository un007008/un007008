"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Entry = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  active: boolean;
};

const EMPTY = { question: "", answer: "", category: "" };

export function KnowledgeClient() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/knowledge");
    if (res.ok) setEntries(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.question.trim() || !form.answer.trim()) return;
    setBusy(true);
    try {
      if (editingId) {
        await fetch(`/api/knowledge/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      } else {
        await fetch("/api/knowledge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
      }
      setForm(EMPTY);
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(entry: Entry) {
    await fetch(`/api/knowledge/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !entry.active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("ลบคำถาม-คำตอบนี้?")) return;
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    await load();
  }

  function startEdit(entry: Entry) {
    setEditingId(entry.id);
    setForm({
      question: entry.question,
      answer: entry.answer,
      category: entry.category ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      {/* add / edit form */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">
          {editingId ? "แก้ไขคำถาม-คำตอบ" : "เพิ่มคำถาม-คำตอบใหม่"}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="kb-q">คำถาม</Label>
          <Input
            id="kb-q"
            value={form.question}
            onChange={(e) => setForm({ ...form, question: e.target.value })}
            placeholder="เช่น ค่าบริการนายหน้าเท่าไหร่"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kb-a">คำตอบ (AI จะใช้ตอบลูกค้าตามนี้)</Label>
          <Textarea
            id="kb-a"
            rows={3}
            value={form.answer}
            onChange={(e) => setForm({ ...form, answer: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="kb-c">หมวดหมู่ (ไม่บังคับ)</Label>
          <Input
            id="kb-c"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            placeholder="เช่น fees, rent, legal"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void submit()} disabled={busy || !form.question.trim() || !form.answer.trim()}>
            {editingId ? "บันทึกการแก้ไข" : "เพิ่มเข้า Knowledge Base"}
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
        {entries.map((e) => (
          <div key={e.id} className="space-y-1.5 rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{e.question}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                {e.category && <Badge variant="outline">{e.category}</Badge>}
                <Badge variant={e.active ? "success" : "secondary"}>
                  {e.active ? "เปิดใช้" : "ปิดอยู่"}
                </Badge>
              </div>
            </div>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.answer}</p>
            <div className="flex gap-1.5 pt-1">
              <Button size="sm" variant="outline" onClick={() => startEdit(e)}>
                แก้ไข
              </Button>
              <Button size="sm" variant="outline" onClick={() => void toggleActive(e)}>
                {e.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void remove(e.id)}>
                ลบ
              </Button>
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            ยังไม่มีข้อมูลใน Knowledge Base
          </p>
        )}
      </div>
    </div>
  );
}
