"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageManager, type PropertyImageItem } from "./image-manager";

type Lang = { th: string; en: string; zh: string };

export type PropertyFormData = {
  id?: string;
  refCode: string;
  status: string;
  listingType: string;
  propertyType: string;
  title: Lang;
  description: Lang;
  priceSale: string;
  priceRent: string;
  bedrooms: string;
  bathrooms: string;
  areaSqm: string;
  floor: string;
  projectName: string;
  district: string;
  btsMrt: string;
  lat: string;
  lng: string;
  featured: boolean;
  images: PropertyImageItem[];
};

const STATUS_OPTIONS = [
  ["AVAILABLE", "พร้อมขาย/เช่า"],
  ["RESERVED", "ติดจอง"],
  ["SOLD", "ขายแล้ว"],
  ["RENTED", "ปล่อยเช่าแล้ว"],
  ["HIDDEN", "ซ่อน"],
] as const;

const LISTING_OPTIONS = [
  ["SALE", "ขาย"],
  ["RENT", "เช่า"],
  ["SALE_AND_RENT", "ขายและเช่า"],
] as const;

const TYPE_OPTIONS = [
  ["CONDO", "คอนโด"],
  ["HOUSE", "บ้านเดี่ยว"],
  ["TOWNHOUSE", "ทาวน์เฮาส์"],
  ["COMMERCIAL", "อาคารพาณิชย์"],
  ["LAND", "ที่ดิน"],
] as const;

function Select({
  id,
  value,
  options,
  onChange,
}: {
  id: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function num(v: string): number | null {
  return v.trim() === "" ? null : Number(v);
}

export function PropertyForm({ initial }: { initial: PropertyFormData | null }) {
  const router = useRouter();
  const [form, setForm] = useState<PropertyFormData>(
    initial ?? {
      refCode: "",
      status: "AVAILABLE",
      listingType: "SALE",
      propertyType: "CONDO",
      title: { th: "", en: "", zh: "" },
      description: { th: "", en: "", zh: "" },
      priceSale: "",
      priceRent: "",
      bedrooms: "",
      bathrooms: "",
      areaSqm: "",
      floor: "",
      projectName: "",
      district: "",
      btsMrt: "",
      lat: "",
      lng: "",
      featured: false,
      images: [],
    }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<PropertyFormData>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.refCode.trim() || !form.title.th.trim()) {
      setError("กรุณากรอกรหัสทรัพย์และชื่อภาษาไทย");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        refCode: form.refCode,
        status: form.status,
        listingType: form.listingType,
        propertyType: form.propertyType,
        title: form.title,
        description: form.description,
        priceSale: num(form.priceSale),
        priceRent: num(form.priceRent),
        bedrooms: num(form.bedrooms),
        bathrooms: num(form.bathrooms),
        areaSqm: num(form.areaSqm),
        floor: num(form.floor),
        projectName: form.projectName,
        district: form.district,
        btsMrt: form.btsMrt,
        lat: num(form.lat),
        lng: num(form.lng),
        featured: form.featured,
      };
      const res = form.id
        ? await fetch(`/api/admin/properties/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/properties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? `บันทึกไม่สำเร็จ (${res.status})`);
        return;
      }
      if (!form.id) {
        const created = (await res.json()) as { id: string };
        router.push(`/admin/properties/${created.id}`); // go add photos
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    if (!confirm("ลบทรัพย์นี้ถาวร? รูปทั้งหมดจะถูกลบด้วย")) return;
    const res = await fetch(`/api/admin/properties/${form.id}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/properties");
  }

  return (
    <div className="space-y-4">
      {/* basics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="refCode">รหัสทรัพย์ *</Label>
          <Input
            id="refCode"
            value={form.refCode}
            onChange={(e) => set({ refCode: e.target.value })}
            placeholder="PS-00006"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="status">สถานะ</Label>
          <Select id="status" value={form.status} options={STATUS_OPTIONS} onChange={(v) => set({ status: v })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="listingType">ขาย/เช่า</Label>
          <Select id="listingType" value={form.listingType} options={LISTING_OPTIONS} onChange={(v) => set({ listingType: v })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="propertyType">ประเภท</Label>
          <Select id="propertyType" value={form.propertyType} options={TYPE_OPTIONS} onChange={(v) => set({ propertyType: v })} />
        </div>
      </div>

      {/* title / description */}
      <div className="space-y-2 rounded-lg border p-3">
        <p className="text-sm font-semibold">ชื่อและคำอธิบาย</p>
        <div className="space-y-1.5">
          <Label htmlFor="title-th">ชื่อ (ไทย) *</Label>
          <Input id="title-th" value={form.title.th} onChange={(e) => set({ title: { ...form.title, th: e.target.value } })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="title-en">Title (EN)</Label>
            <Input id="title-en" value={form.title.en} onChange={(e) => set({ title: { ...form.title, en: e.target.value } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title-zh">标题 (ZH)</Label>
            <Input id="title-zh" value={form.title.zh} onChange={(e) => set({ title: { ...form.title, zh: e.target.value } })} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="desc-th">คำอธิบาย (ไทย)</Label>
          <Textarea id="desc-th" rows={3} value={form.description.th} onChange={(e) => set({ description: { ...form.description, th: e.target.value } })} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="desc-en">Description (EN)</Label>
            <Textarea id="desc-en" rows={2} value={form.description.en} onChange={(e) => set({ description: { ...form.description, en: e.target.value } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc-zh">描述 (ZH)</Label>
            <Textarea id="desc-zh" rows={2} value={form.description.zh} onChange={(e) => set({ description: { ...form.description, zh: e.target.value } })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          เว้น EN/ZH ไว้ได้ — ระบบแปลอัตโนมัติจะเพิ่มในขั้นถัดไป
        </p>
      </div>

      {/* price / spec */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="priceSale">ราคาขาย (บาท)</Label>
          <Input id="priceSale" inputMode="numeric" value={form.priceSale} onChange={(e) => set({ priceSale: e.target.value.replace(/[^\d.]/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="priceRent">ค่าเช่า (บาท/เดือน)</Label>
          <Input id="priceRent" inputMode="numeric" value={form.priceRent} onChange={(e) => set({ priceRent: e.target.value.replace(/[^\d.]/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bedrooms">ห้องนอน</Label>
          <Input id="bedrooms" inputMode="numeric" value={form.bedrooms} onChange={(e) => set({ bedrooms: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bathrooms">ห้องน้ำ</Label>
          <Input id="bathrooms" inputMode="numeric" value={form.bathrooms} onChange={(e) => set({ bathrooms: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="areaSqm">พื้นที่ (ตร.ม.)</Label>
          <Input id="areaSqm" inputMode="decimal" value={form.areaSqm} onChange={(e) => set({ areaSqm: e.target.value.replace(/[^\d.]/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="floor">ชั้น</Label>
          <Input id="floor" inputMode="numeric" value={form.floor} onChange={(e) => set({ floor: e.target.value.replace(/\D/g, "") })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="projectName">โครงการ</Label>
          <Input id="projectName" value={form.projectName} onChange={(e) => set({ projectName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="district">เขต/ทำเล</Label>
          <Input id="district" value={form.district} onChange={(e) => set({ district: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="btsMrt">BTS/MRT ใกล้เคียง</Label>
          <Input id="btsMrt" value={form.btsMrt} onChange={(e) => set({ btsMrt: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lat">ละติจูด</Label>
          <Input id="lat" inputMode="decimal" value={form.lat} onChange={(e) => set({ lat: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lng">ลองจิจูด</Label>
          <Input id="lng" inputMode="decimal" value={form.lng} onChange={(e) => set({ lng: e.target.value })} />
        </div>
        <div className="flex items-end gap-2 pb-1.5">
          <input
            id="featured"
            type="checkbox"
            checked={form.featured}
            onChange={(e) => set({ featured: e.target.checked })}
            className="h-4 w-4"
          />
          <Label htmlFor="featured">ทรัพย์แนะนำ (โชว์หน้าแรก)</Label>
        </div>
      </div>

      {/* images — only after created */}
      {form.id ? (
        <ImageManager propertyId={form.id} initialImages={form.images} />
      ) : (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          บันทึกทรัพย์ก่อน แล้วจึงเพิ่มรูปได้
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "กำลังบันทึก…" : form.id ? "บันทึกการแก้ไข" : "สร้างทรัพย์"}
        </Button>
        {form.id && (
          <Button variant="destructive" onClick={() => void remove()}>
            ลบทรัพย์
          </Button>
        )}
      </div>
    </div>
  );
}
