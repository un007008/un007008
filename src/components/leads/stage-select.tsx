"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export const STAGE_LABEL: Record<string, string> = {
  NEW: "ใหม่",
  CONTACTED: "ติดต่อแล้ว",
  QUALIFIED: "คัดกรองแล้ว",
  VIEWING_SCHEDULED: "นัดชมแล้ว",
  VIEWED: "ชมแล้ว",
  OFFER: "ยื่นข้อเสนอ",
  CLOSED_WON: "ปิดสำเร็จ",
  CLOSED_LOST: "ปิดไม่สำเร็จ",
};

export function StageSelect({ leadId, stage }: { leadId: string; stage: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function change(next: string) {
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={stage}
      disabled={saving}
      onChange={(e) => void change(e.target.value)}
      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
    >
      {Object.entries(STAGE_LABEL).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
