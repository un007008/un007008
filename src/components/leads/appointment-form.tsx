"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PropertyOption = { id: string; refCode: string; title: string };

export function AppointmentForm({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState("");
  const [datetime, setDatetime] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const res = await fetch("/api/properties");
      if (res.ok) setProperties(await res.json());
    })();
  }, [open]);

  async function submit() {
    if (!propertyId || !datetime) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, datetime, note }),
      });
      if (res.ok) {
        setOpen(false);
        setPropertyId("");
        setDatetime("");
        setNote("");
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        + นัดชม
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border p-2.5">
      <div className="space-y-1">
        <Label className="text-xs">ทรัพย์</Label>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="">— เลือกทรัพย์ —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.refCode} — {p.title}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">วันเวลา</Label>
        <Input type="datetime-local" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">โน้ต</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ลูกค้าขอชมช่วงเย็น" />
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void submit()} disabled={saving || !propertyId || !datetime}>
          {saving ? "กำลังบันทึก…" : "บันทึกนัด"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

const APPT_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "นัดแล้ว",
  DONE: "ชมแล้ว",
  CANCELLED: "ยกเลิก",
  NO_SHOW: "ไม่มา",
};

export function AppointmentStatusSelect({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function change(value: string) {
    setSaving(true);
    try {
      await fetch(`/api/appointments/${appointmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <select
      value={status}
      disabled={saving}
      onChange={(e) => void change(e.target.value)}
      className="h-7 rounded-md border border-input bg-background px-1.5 text-xs"
    >
      {Object.entries(APPT_STATUS_LABEL).map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
