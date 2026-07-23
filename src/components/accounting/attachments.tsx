"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type Attachment = { id: string; name: string; url: string };

export function DocumentAttachments({
  documentId,
  attachments,
}: {
  documentId: string;
  attachments: Attachment[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch(`/api/admin/accounting/documents/${documentId}/attachments`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error ?? "อัปโหลดไม่สำเร็จ");
      }
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Attachment) {
    if (!confirm(`ลบไฟล์ "${a.name}"?`)) return;
    const res = await fetch(
      `/api/admin/accounting/documents/${documentId}/attachments/${a.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error ?? "ลบไม่สำเร็จ");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg border p-3 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">ไฟล์แนบ (สลิป/ใบกำกับภาษี/สัญญา)</p>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "กำลังอัปโหลด…" : "+ แนบไฟล์"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">ยังไม่มีไฟล์แนบ</p>
      ) : (
        <ul className="space-y-1">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="truncate underline"
              >
                {a.name}
              </a>
              <Button size="sm" variant="ghost" onClick={() => void remove(a)}>
                ลบ
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
