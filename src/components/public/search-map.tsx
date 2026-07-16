"use client";

import { useEffect, useRef, useState } from "react";

export type MapPin = {
  slug: string;
  lat: number;
  lng: number;
  title: string;
  priceLabel: string;
};

/**
 * Property search map with price pins.
 * Uses Leaflet + OpenStreetMap tiles (free, no API key).
 * Swap the tile layer for Longdo/Google later if needed.
 */
export function SearchMap({
  pins,
  locale,
  toggleLabel,
}: {
  pins: MapPin[];
  locale: string;
  toggleLabel: { show: string; hide: string };
}) {
  const [open, setOpen] = useState(false);

  // bindPopup renders raw HTML — escape the admin-authored title
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ReturnType<typeof import("leaflet")["map"]> | null>(null);

  useEffect(() => {
    if (!open || !containerRef.current || mapRef.current) return;
    let cancelled = false;

    void (async () => {
      const L = (await import("leaflet")).default;
      // leaflet css (bundled)
      await import("leaflet/dist/leaflet.css" as string);
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false });
      mapRef.current = map;

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const bounds = L.latLngBounds([]);
      for (const pin of pins) {
        const icon = L.divIcon({
          className: "",
          html: `<div style="background:#111;color:#fff;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.3)">${esc(pin.priceLabel)}</div>`,
          iconSize: [0, 0],
          iconAnchor: [30, 14],
        });
        L.marker([pin.lat, pin.lng], { icon })
          .addTo(map)
          .bindPopup(
            `<a href="/${esc(locale)}/properties/${esc(pin.slug)}" style="font-size:13px;font-weight:600">${esc(pin.title)}</a><br><span style="font-size:12px">${esc(pin.priceLabel)}</span>`
          );
        bounds.extend([pin.lat, pin.lng]);
      }
      if (pins.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } else {
        map.setView([13.7563, 100.5018], 11); // Bangkok
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [open, pins, locale]);

  if (pins.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
      >
        {open ? `🗺 ${toggleLabel.hide}` : `🗺 ${toggleLabel.show} (${pins.length})`}
      </button>
      {open && <div ref={containerRef} className="h-80 w-full rounded-xl border" />}
    </div>
  );
}
