"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function NoteEditor({ leadId, note }: { leadId: string; note: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = value !== (note ?? "");

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: value }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)} />
      {dirty && (
        <Button size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "กำลังบันทึก…" : "บันทึกโน้ต"}
        </Button>
      )}
    </div>
  );
}
