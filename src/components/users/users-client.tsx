"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type User = { id: string; name: string; role: "ADMIN" | "SALES" | "CR" };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "ผู้ดูแลระบบ",
  SALES: "ฝ่ายขาย",
  CR: "ลูกค้าสัมพันธ์",
};

const EMPTY = { email: "", name: "", password: "", role: "SALES" };

export function UsersClient({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<(User & { email?: string })[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) {
        setForm(EMPTY);
        setMessage("เพิ่มผู้ใช้แล้ว ✓");
        await load();
      } else {
        setError(data?.error ?? "เพิ่มไม่สำเร็จ");
      }
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, role: string) {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(data?.error ?? "เปลี่ยนไม่สำเร็จ");
    }
    await load();
  }

  async function resetPassword(id: string, name: string) {
    const password = prompt(`ตั้งรหัสผ่านใหม่ให้ ${name} (อย่างน้อย 8 ตัว):`);
    if (!password) return;
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    alert(res.ok ? "ตั้งรหัสใหม่แล้ว ✓" : (data?.error ?? "ไม่สำเร็จ"));
  }

  async function remove(id: string, name: string) {
    if (!confirm(`ลบผู้ใช้ ${name}? Lead ที่ดูแลอยู่จะถูกปลดผู้ดูแล`)) return;
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      alert(data?.error ?? "ลบไม่สำเร็จ");
    }
    await load();
  }

  return (
    <div className="space-y-4">
      {/* add user */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">เพิ่มผู้ใช้ใหม่</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="u-name">ชื่อ</Label>
            <Input id="u-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-email">อีเมล (ใช้ login)</Label>
            <Input id="u-email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-pass">รหัสผ่าน (อย่างน้อย 8 ตัว)</Label>
            <Input id="u-pass" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="u-role">บทบาท</Label>
            <select
              id="u-role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {Object.entries(ROLE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {message && <p className="text-sm text-emerald-600">{message}</p>}
        <Button onClick={() => void create()} disabled={busy || !form.name || !form.email || !form.password}>
          {busy ? "กำลังเพิ่ม…" : "เพิ่มผู้ใช้"}
        </Button>
      </div>

      {/* list */}
      <div className="space-y-2">
        {users.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                {u.name} {u.id === selfId && <Badge variant="outline">คุณ</Badge>}
              </p>
            </div>
            <select
              value={u.role}
              disabled={u.id === selfId}
              onChange={(e) => void changeRole(u.id, e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              {Object.entries(ROLE_LABEL).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" onClick={() => void resetPassword(u.id, u.name)}>
              ตั้งรหัสใหม่
            </Button>
            {u.id !== selfId && (
              <Button size="sm" variant="destructive" onClick={() => void remove(u.id, u.name)}>
                ลบ
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
