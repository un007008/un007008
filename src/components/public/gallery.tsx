"use client";

import { useState } from "react";

export function Gallery({
  images,
  alt,
}: {
  images: { url: string; thumbUrl: string }[];
  alt: string;
}) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-xl bg-muted text-5xl">
        🏠
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index].url} alt={alt} className="aspect-[4/3] w-full object-cover" />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.url}
              onClick={() => setIndex(i)}
              className={`h-16 w-20 shrink-0 overflow-hidden rounded-md border-2 ${i === index ? "border-primary" : "border-transparent"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbUrl} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
