"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

type Asset = {
  id: string;
  url: string;
  thumbUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

function fmtSize(bytes: number) {
  if (bytes > 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export function MediaClient() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/media");
    if (res.ok) setAssets(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      if (res.ok) await load();
      else alert("อัปโหลดไม่สำเร็จ");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove(id: string) {
    if (!confirm("ลบไฟล์นี้?")) return;
    const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
    if (res.ok) setAssets((prev) => prev.filter((a) => a.id !== id));
  }

  async function copyUrl(asset: Asset) {
    const url = asset.url.startsWith("http")
      ? asset.url
      : `${window.location.origin}${asset.url}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(asset.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{assets.length} ไฟล์</p>
        <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? "กำลังอัปโหลด…" : "+ อัปโหลดไฟล์"}
        </Button>
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {assets.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-lg border">
            <div className="flex aspect-[4/3] items-center justify-center bg-muted">
              {a.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.thumbUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-2xl">📄</span>
              )}
            </div>
            <div className="space-y-1 p-2">
              <p className="truncate text-[10px] text-muted-foreground">
                {a.mimeType} · {fmtSize(a.sizeBytes)}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="h-7 flex-1 text-xs" onClick={() => void copyUrl(a)}>
                  {copiedId === a.id ? "คัดลอกแล้ว ✓" : "คัดลอก URL"}
                </Button>
                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => void remove(a.id)}>
                  ลบ
                </Button>
              </div>
            </div>
          </div>
        ))}
        {assets.length === 0 && (
          <p className="col-span-full rounded-lg border p-8 text-center text-sm text-muted-foreground">
            ยังไม่มีไฟล์ — กดอัปโหลดเพื่อเริ่ม
          </p>
        )}
      </div>
    </div>
  );
}
