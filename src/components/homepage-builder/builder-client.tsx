"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SECTION_LABEL,
  type HomepageConfig,
  type LangText,
  type SectionConfig,
} from "@/lib/sections/schema";

function LangFields({
  label,
  value,
  onChange,
  onManualEdit,
}: {
  label: string;
  value: LangText;
  onChange: (v: LangText) => void;
  onManualEdit: (lang: "en" | "zh") => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        value={value.th}
        onChange={(e) => onChange({ ...value, th: e.target.value })}
        placeholder="ไทย"
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Input
          value={value.en}
          onChange={(e) => {
            onChange({ ...value, en: e.target.value });
            onManualEdit("en");
          }}
          placeholder="EN"
          className="text-xs"
        />
        <Input
          value={value.zh}
          onChange={(e) => {
            onChange({ ...value, zh: e.target.value });
            onManualEdit("zh");
          }}
          placeholder="ZH"
          className="text-xs"
        />
      </div>
    </div>
  );
}

function SortableSection({
  section,
  expanded,
  onToggleExpand,
  onUpdate,
  onTranslate,
  translating,
}: {
  section: SectionConfig;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: Partial<SectionConfig>) => void;
  onTranslate: () => void;
  translating: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const markEdited = (lang: "en" | "zh") =>
    onUpdate(lang === "en" ? { editedEn: true } : { editedZh: true });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-lg border bg-background ${isDragging ? "z-10 opacity-80 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2 p-2.5">
        <button
          className="cursor-grab touch-none px-1 text-muted-foreground"
          aria-label="ลากเพื่อจัดลำดับ"
          {...attributes}
          {...listeners}
        >
          ⠿
        </button>
        <button onClick={onToggleExpand} className="min-w-0 flex-1 text-left">
          <span className="text-sm font-medium">{SECTION_LABEL[section.type]}</span>
        </button>
        {!section.visible && <Badge variant="secondary">ซ่อนอยู่</Badge>}
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={section.visible}
            onChange={(e) => onUpdate({ visible: e.target.checked })}
            className="h-4 w-4"
          />
          แสดง
        </label>
        <button onClick={onToggleExpand} className="px-1 text-muted-foreground">
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className="space-y-3 border-t p-3">
          <LangFields
            label="หัวข้อ"
            value={section.title}
            onChange={(title) => onUpdate({ title })}
            onManualEdit={markEdited}
          />
          <LangFields
            label="คำโปรย"
            value={section.subtitle}
            onChange={(subtitle) => onUpdate({ subtitle })}
            onManualEdit={markEdited}
          />
          {(section.type === "promotionBanner" || section.type === "cta") && (
            <>
              {section.buttonLabel && (
                <LangFields
                  label="ข้อความปุ่ม"
                  value={section.buttonLabel}
                  onChange={(buttonLabel) => onUpdate({ buttonLabel })}
                  onManualEdit={markEdited}
                />
              )}
              <div className="space-y-1.5">
                <Label className="text-xs">ลิงก์ปุ่ม (URL)</Label>
                <Input
                  value={section.buttonUrl ?? ""}
                  onChange={(e) => onUpdate({ buttonUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={translating}
              onClick={onTranslate}
              title="แปลช่องไทยเป็น EN/ZH (ข้ามช่องที่แก้เองแล้ว)"
            >
              {translating ? "กำลังแปล…" : "🌐 แปล EN/ZH อัตโนมัติ"}
            </Button>
            {(section.editedEn || section.editedZh) && (
              <span className="text-xs text-muted-foreground">
                {[section.editedEn && "EN", section.editedZh && "ZH"]
                  .filter(Boolean)
                  .join(", ")}{" "}
                แก้เองแล้ว จะไม่ถูกแปลทับ
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function BuilderClient() {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } })
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/homepage");
    if (res.ok) {
      const data = (await res.json()) as HomepageConfig;
      setConfig(data);
      setSavedJson(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = config != null && JSON.stringify(config) !== savedJson;

  function updateSection(id: string, patch: Partial<SectionConfig>) {
    setConfig((c) =>
      c
        ? { sections: c.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }
        : c
    );
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !config) return;
    const oldIndex = config.sections.findIndex((s) => s.id === active.id);
    const newIndex = config.sections.findIndex((s) => s.id === over.id);
    setConfig({ sections: arrayMove(config.sections, oldIndex, newIndex) });
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/homepage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        const data = (await res.json()) as HomepageConfig;
        setConfig(data);
        setSavedJson(JSON.stringify(data));
        setMessage("บันทึกแล้ว ✓");
        iframeRef.current?.contentWindow?.location.reload();
      } else {
        setMessage("บันทึกไม่สำเร็จ");
      }
    } finally {
      setSaving(false);
    }
  }

  async function translateSection(section: SectionConfig) {
    setTranslatingId(section.id);
    setMessage(null);
    try {
      const items: { key: string; th: string }[] = [];
      const fields: (keyof SectionConfig)[] = ["title", "subtitle", "buttonLabel"];
      for (const f of fields) {
        const v = section[f] as LangText | undefined;
        if (v?.th?.trim()) items.push({ key: f, th: v.th });
      }
      const res = await fetch("/api/admin/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "แปลไม่สำเร็จ");
        return;
      }
      const { translations } = (await res.json()) as {
        translations: { key: string; en: string; zh: string }[];
      };
      const patch: Partial<SectionConfig> = {};
      for (const tr of translations) {
        const field = tr.key as "title" | "subtitle" | "buttonLabel";
        const current = section[field];
        if (!current) continue;
        patch[field] = {
          th: current.th,
          en: section.editedEn ? current.en : tr.en,
          zh: section.editedZh ? current.zh : tr.zh,
        };
      }
      updateSection(section.id, patch);
      setMessage("แปลแล้ว — อย่าลืมกดบันทึก");
    } finally {
      setTranslatingId(null);
    }
  }

  if (!config) return <p className="text-sm text-muted-foreground">กำลังโหลด…</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* editor */}
      <div className="space-y-2">
        <div className="sticky top-14 z-10 flex items-center gap-2 rounded-lg border bg-background p-2">
          <Button onClick={() => void save()} disabled={!dirty || saving}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
          <Button variant="outline" disabled={!dirty} onClick={() => void load()}>
            รีเซ็ต
          </Button>
          <span className="text-xs text-muted-foreground">
            {dirty ? "⚠ ยังไม่ได้บันทึก" : (message ?? "ไม่มีการแก้ไขค้าง")}
          </span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={config.sections.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {config.sections.map((s) => (
                <SortableSection
                  key={s.id}
                  section={s}
                  expanded={expanded === s.id}
                  onToggleExpand={() => setExpanded(expanded === s.id ? null : s.id)}
                  onUpdate={(patch) => updateSection(s.id, patch)}
                  onTranslate={() => void translateSection(s)}
                  translating={translatingId === s.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* live preview */}
      <div className="hidden lg:block">
        <div className="sticky top-14 space-y-1">
          <p className="text-xs text-muted-foreground">
            พรีวิวหน้าจริง (อัปเดตหลังกดบันทึก)
          </p>
          <iframe
            ref={iframeRef}
            src="/th"
            className="h-[75vh] w-full rounded-lg border"
            title="preview"
          />
        </div>
      </div>
    </div>
  );
}
