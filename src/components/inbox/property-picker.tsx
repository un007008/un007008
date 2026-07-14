"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import type { PropertyOption } from "./types";

export function PropertyPicker({
  onSelect,
  onClose,
}: {
  onSelect: (propertyId: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<PropertyOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/properties?q=${encodeURIComponent(q)}`);
        if (res.ok) setItems(await res.json());
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="absolute bottom-full left-2 right-2 z-20 mb-2 rounded-lg border bg-background shadow-lg">
      <div className="flex items-center gap-2 border-b p-2">
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหา รหัส/โครงการ/ทำเล…"
          className="h-8"
        />
        <button onClick={onClose} className="px-2 text-muted-foreground" aria-label="ปิด">
          ✕
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading && <p className="p-3 text-center text-xs text-muted-foreground">กำลังค้นหา…</p>}
        {!loading && items.length === 0 && (
          <p className="p-3 text-center text-xs text-muted-foreground">ไม่พบทรัพย์</p>
        )}
        {items.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-accent"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {p.refCode} — {p.title}
              </div>
              <div className="text-xs text-muted-foreground">
                {p.priceSale != null && `ขาย ${Number(p.priceSale).toLocaleString("th-TH")} บ.`}
                {p.priceSale != null && p.priceRent != null && " · "}
                {p.priceRent != null && `เช่า ${Number(p.priceRent).toLocaleString("th-TH")} บ./ด.`}
                {p.district && ` · ${p.district}`}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
