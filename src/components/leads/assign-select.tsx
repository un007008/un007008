"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { id: string; name: string; role: string };

export function AssignSelect({
  leadId,
  assignedTo,
}: {
  leadId: string;
  assignedTo: string | null;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/users");
      if (res.ok) setUsers(await res.json());
    })();
  }, []);

  async function change(value: string) {
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: value || null }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={assignedTo ?? ""}
      disabled={saving}
      onChange={(e) => void change(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      <option value="">ยังไม่มอบหมาย</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
