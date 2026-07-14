"use client";

import { useState } from "react";

import type { UIStrings } from "@/lib/i18n";

export function BookingForm({ propertyId, ui }: { propertyId: string; ui: UIStrings }) {
  const [form, setForm] = useState({ name: "", phone: "", datetime: "", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) return;
    setSending(true);
    setError(false);
    try {
      const res = await fetch("/api/public/viewing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, ...form }),
      });
      if (res.ok) setDone(true);
      else setError(true);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
        ✓ {ui.bookingDone}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <input
        required
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        placeholder={ui.yourName}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <input
        required
        inputMode="tel"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        placeholder={ui.yourPhone}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <input
        type="datetime-local"
        value={form.datetime}
        onChange={(e) => setForm({ ...form, datetime: e.target.value })}
        aria-label={ui.preferredDate}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
      <textarea
        rows={2}
        value={form.message}
        onChange={(e) => setForm({ ...form, message: e.target.value })}
        placeholder={ui.message}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />
      {error && <p className="text-xs text-destructive">Error — try again</p>}
      <button
        disabled={sending}
        className="h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {sending ? "…" : ui.submitBooking}
      </button>
    </form>
  );
}
