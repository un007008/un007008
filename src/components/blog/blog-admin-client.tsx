"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Lang = { th: string; en: string; zh: string };
type Post = {
  id: string;
  slug: string;
  title: Lang;
  content: Lang;
  coverUrl: string | null;
  category: string | null;
  tags: string[];
  published: boolean;
  createdAt: string;
};

const EMPTY = {
  title: { th: "", en: "", zh: "" },
  content: { th: "", en: "", zh: "" },
  coverUrl: "",
  category: "",
  tags: "",
};

export function BlogAdminClient() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/blog");
    if (res.ok) setPosts(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit() {
    if (!form.title.th.trim()) return;
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        coverUrl: form.coverUrl,
        category: form.category,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      const res = editingId
        ? await fetch(`/api/admin/blog/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/blog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (res.ok) {
        setForm(EMPTY);
        setEditingId(null);
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  async function togglePublish(post: Post) {
    await fetch(`/api/admin/blog/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !post.published }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("ลบบทความนี้?")) return;
    await fetch(`/api/admin/blog/${id}`, { method: "DELETE" });
    if (editingId === id) {
      setEditingId(null);
      setForm(EMPTY);
    }
    await load();
  }

  function startEdit(post: Post) {
    setEditingId(post.id);
    setForm({
      title: { th: post.title?.th ?? "", en: post.title?.en ?? "", zh: post.title?.zh ?? "" },
      content: {
        th: post.content?.th ?? "",
        en: post.content?.en ?? "",
        zh: post.content?.zh ?? "",
      },
      coverUrl: post.coverUrl ?? "",
      category: post.category ?? "",
      tags: post.tags.join(", "),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">{editingId ? "แก้ไขบทความ" : "เขียนบทความใหม่"}</p>
        <div className="space-y-1.5">
          <Label>หัวข้อ (ไทย) *</Label>
          <Input value={form.title.th} onChange={(e) => setForm({ ...form, title: { ...form.title, th: e.target.value } })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="Title (EN)" value={form.title.en} onChange={(e) => setForm({ ...form, title: { ...form.title, en: e.target.value } })} />
          <Input placeholder="标题 (ZH)" value={form.title.zh} onChange={(e) => setForm({ ...form, title: { ...form.title, zh: e.target.value } })} />
        </div>
        <div className="space-y-1.5">
          <Label>เนื้อหา (ไทย, markdown)</Label>
          <Textarea rows={8} value={form.content.th} onChange={(e) => setForm({ ...form, content: { ...form.content, th: e.target.value } })} placeholder="## หัวข้อย่อย&#10;&#10;เนื้อหา…" />
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Textarea rows={4} placeholder="Content (EN, markdown)" value={form.content.en} onChange={(e) => setForm({ ...form, content: { ...form.content, en: e.target.value } })} />
          <Textarea rows={4} placeholder="内容 (ZH, markdown)" value={form.content.zh} onChange={(e) => setForm({ ...form, content: { ...form.content, zh: e.target.value } })} />
        </div>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label>รูปปก (URL — คัดลอกจากคลังสื่อ)</Label>
            <Input value={form.coverUrl} onChange={(e) => setForm({ ...form, coverUrl: e.target.value })} placeholder="/uploads/media/…" />
          </div>
          <div className="space-y-1.5">
            <Label>หมวดหมู่</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="เช่น ความรู้อสังหาฯ" />
          </div>
          <div className="space-y-1.5">
            <Label>แท็ก (คั่นด้วยจุลภาค)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="คอนโด, ลงทุน" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => void submit()} disabled={busy || !form.title.th.trim()}>
            {editingId ? "บันทึกการแก้ไข" : "บันทึกบทความ (ฉบับร่าง)"}
          </Button>
          {editingId && (
            <Button variant="ghost" onClick={() => { setEditingId(null); setForm(EMPTY); }}>
              ยกเลิก
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {posts.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.title?.th}</p>
              <p className="text-xs text-muted-foreground">
                /{p.slug} · {new Date(p.createdAt).toLocaleDateString("th-TH")}
                {p.category && ` · ${p.category}`}
              </p>
            </div>
            <Badge variant={p.published ? "success" : "secondary"}>
              {p.published ? "เผยแพร่แล้ว" : "ฉบับร่าง"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void togglePublish(p)}>
              {p.published ? "ซ่อน" : "เผยแพร่"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => startEdit(p)}>
              แก้ไข
            </Button>
            <Button size="sm" variant="destructive" onClick={() => void remove(p.id)}>
              ลบ
            </Button>
          </div>
        ))}
        {posts.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">ยังไม่มีบทความ</p>
        )}
      </div>
    </div>
  );
}
