"use client";

import Image from "next/image";
import { useState } from "react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, select] = useState(0);
  const files = images.length ? images : ["/products/workspace.jpg"];
  return (
    <div>
      <div className="detail-photo">
        <Image
          src={files[index] ?? files[0]}
          alt={name}
          fill
          preload
          sizes="(min-width: 760px) 50vw, 100vw"
        />
      </div>
      {files.length > 1 && (
        <div className="thumbnails">
          {files.map((image, i) => (
            <button
              key={`${image}-${i}`}
              type="button"
              aria-label={`Ver imagen ${i + 1}`}
              aria-pressed={index === i}
              onClick={() => select(i)}
            >
              <Image src={image} alt="" width={82} height={64} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
