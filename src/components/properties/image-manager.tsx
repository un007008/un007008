"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Button } from "@/components/ui/button";

export type PropertyImageItem = {
  id: string;
  url: string;
  thumbUrl: string;
  order: number;
};

function SortableImage({
  image,
  onDelete,
}: {
  image: PropertyImageItem;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative aspect-[4/3] overflow-hidden rounded-md border bg-muted ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image.thumbUrl}
        alt=""
        className="h-full w-full cursor-grab object-cover"
        {...attributes}
        {...listeners}
      />
      <button
        type="button"
        onClick={() => onDelete(image.id)}
        className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
        aria-label="ลบรูป"
      >
        ✕
      </button>
    </div>
  );
}

export function ImageManager({
  propertyId,
  initialImages,
}: {
  propertyId: string;
  initialImages: PropertyImageItem[];
}) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) form.append("files", f);
      const res = await fetch(`/api/admin/properties/${propertyId}/images`, {
        method: "POST",
        body: form,
      });
      if (res.ok) {
        const created = (await res.json()) as PropertyImageItem[];
        setImages((prev) => [...prev, ...created]);
      } else {
        alert("อัปโหลดไม่สำเร็จ");
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex((i) => i.id === active.id);
    const newIndex = images.findIndex((i) => i.id === over.id);
    const next = arrayMove(images, oldIndex, newIndex);
    setImages(next);
    await fetch(`/api/admin/properties/${propertyId}/images`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((i) => i.id) }),
    });
  }

  async function remove(imageId: string) {
    if (!confirm("ลบรูปนี้?")) return;
    const res = await fetch(`/api/admin/properties/${propertyId}/images/${imageId}`, {
      method: "DELETE",
    });
    if (res.ok) setImages((prev) => prev.filter((i) => i.id !== imageId));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">รูปภาพ ({images.length}) — ลากเพื่อจัดลำดับ รูปแรกคือรูปปก</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? "กำลังอัปโหลด…" : "+ เพิ่มรูป"}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => void upload(e.target.files)}
        />
      </div>
      {images.length === 0 ? (
        <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          ยังไม่มีรูป
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
              {images.map((img) => (
                <SortableImage key={img.id} image={img} onDelete={(id) => void remove(id)} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
