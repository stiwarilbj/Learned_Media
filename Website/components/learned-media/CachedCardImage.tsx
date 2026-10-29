"use client";

import { useEffect, useRef, useState } from "react";
import { mountDecodedCardImage } from "@/lib/card-image-cache";

export function CachedCardImage({ workspaceId, url, alt, onError }: {
  workspaceId: string;
  url: string;
  alt: string;
  onError: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    setFallback(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    return mountDecodedCardImage(canvas, workspaceId, url, () => setFallback(true));
  }, [url, workspaceId]);

  if (fallback) return <img src={url} alt={alt} loading="lazy" decoding="async" width="960" height="540" onError={onError} />;
  return <canvas ref={canvasRef} className="card-image-canvas" role="img" aria-label={alt} width="960" height="540" />;
}
