"use client";

import { Fragment, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

type VirtualRow<T> = { key: string; items: T[]; start: number };
type Anchor = { key: string; offset: number; viewportTop: number };

function scrollHost() {
  const element = document.querySelector<HTMLElement>(".main-scroll");
  if (!element) return null;
  const overflow = getComputedStyle(element).overflowY;
  return (overflow === "auto" || overflow === "scroll") && element.scrollHeight > element.clientHeight + 2 ? element : null;
}

function metrics() {
  const host = scrollHost();
  const rootTop = host?.getBoundingClientRect().top ?? 0;
  const scrollTop = host?.scrollTop ?? window.scrollY;
  return { host, rootTop, scrollTop, height: host?.clientHeight ?? window.innerHeight };
}

function lowerBound(offsets: number[], target: number) {
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2);
    if (offsets[middle] <= target) low = middle;
    else high = middle - 1;
  }
  return low;
}

const MeasuredRow = memo(function MeasuredRow({ row, top, height, columns, gap, onMeasure, renderItem, getItemKey, onPin }: {
  row: VirtualRow<unknown>;
  top: number;
  height: number;
  columns: number;
  gap: number;
  onMeasure: (key: string, height: number) => void;
  renderItem: (item: unknown) => ReactNode;
  getItemKey: (item: unknown) => string;
  onPin: (key: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = rowRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      const actual = entry?.borderBoxSize?.[0]?.blockSize ?? entry?.contentRect.height;
      if (actual) onMeasure(row.key, actual + gap);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [gap, onMeasure, row.key]);

  return <div ref={rowRef} className="virtualized-row" data-virtualized-row-key={row.key} onFocusCapture={() => onPin(row.key)} style={{ top, minHeight: Math.max(1, height - gap), gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
    {row.items.map((item) => <Fragment key={getItemKey(item)}>{renderItem(item)}</Fragment>)}
  </div>;
});

export function VirtualizedRows<T>({ items, columns, estimatedHeight, gap = 16, className, getKey, renderItem }: {
  items: T[];
  columns: number;
  estimatedHeight: number;
  gap?: number;
  className: string;
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState({ top: 0, height: 800 });
  const [measured, setMeasured] = useState<Map<string, number>>(() => new Map());
  const [pinnedRowKey, setPinnedRowKey] = useState<string | null>(null);
  const offsetsRef = useRef<number[]>([0]);
  const rows = useMemo<VirtualRow<T>[]>(() => {
    const result: VirtualRow<T>[] = [];
    for (let start = 0; start < items.length; start += columns) {
      const group = items.slice(start, start + columns);
      result.push({ key: group.map(getKey).join("\u0000"), items: group, start });
    }
    return result;
  }, [columns, getKey, items]);
  const rowIndexes = useMemo(() => new Map(rows.map((row, index) => [row.key, index])), [rows]);
  const offsets = useMemo(() => {
    const result = new Array<number>(rows.length + 1);
    result[0] = 0;
    for (let index = 0; index < rows.length; index += 1) result[index + 1] = result[index] + (measured.get(rows[index].key) ?? estimatedHeight + gap);
    offsetsRef.current = result;
    return result;
  }, [estimatedHeight, gap, measured, rows]);
  const range = useMemo(() => {
    const overscan = Math.max(320, scrollPosition.height);
    const start = Math.max(0, lowerBound(offsets, Math.max(0, scrollPosition.top - overscan)));
    const end = Math.min(rows.length, lowerBound(offsets, scrollPosition.top + scrollPosition.height + overscan) + 2);
    return { start, end };
  }, [offsets, rows.length, scrollPosition]);
  const pinnedRowIndex = pinnedRowKey === null ? -1 : rowIndexes.get(pinnedRowKey) ?? -1;
  const visibleIndexes = useMemo(() => {
    const indexes = Array.from({ length: range.end - range.start }, (_, offset) => range.start + offset);
    if (pinnedRowIndex >= 0 && (pinnedRowIndex < range.start || pinnedRowIndex >= range.end)) indexes.push(pinnedRowIndex);
    return indexes.sort((left, right) => left - right);
  }, [pinnedRowIndex, range]);

  useEffect(() => {
    const validKeys = new Set(rows.map((row) => row.key));
    setMeasured((current) => {
      if (Array.from(current.keys()).every((key) => validKeys.has(key))) return current;
      return new Map(Array.from(current).filter(([key]) => validKeys.has(key)));
    });
    if (pinnedRowKey && !validKeys.has(pinnedRowKey)) setPinnedRowKey(null);
  }, [pinnedRowKey, rows]);
  const pendingAnchor = useRef<Anchor | null>(null);

  const captureAnchor = useCallback(() => {
    const content = contentRef.current;
    if (!content || !rows.length) return null;
    const { rootTop, scrollTop } = metrics();
    const listTop = content.getBoundingClientRect().top + scrollTop - rootTop;
    const index = Math.min(rows.length - 1, lowerBound(offsetsRef.current, Math.max(0, scrollTop - listTop)));
    return { key: rows[index].key, offset: offsetsRef.current[index], viewportTop: listTop + offsetsRef.current[index] - scrollTop };
  }, [rows]);

  const onMeasure = useCallback((key: string, height: number) => {
    setMeasured((current) => {
      const prior = current.get(key);
      if (prior !== undefined && Math.abs(prior - height) < 1) return current;
      if (!pendingAnchor.current) pendingAnchor.current = captureAnchor();
      const next = new Map(current);
      next.set(key, height);
      return next;
    });
  }, [captureAnchor]);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const content = contentRef.current;
    if (!content) return;
    const index = rows.findIndex((row) => row.key === anchor.key);
    if (index < 0) return;
    const { host, rootTop, scrollTop } = metrics();
    const listTop = content.getBoundingClientRect().top + scrollTop - rootTop;
    const newViewportTop = listTop + offsets[index] - scrollTop;
    const delta = newViewportTop - anchor.viewportTop;
    if (Math.abs(delta) < 1) return;
    if (host) host.scrollTop += delta;
    else window.scrollBy({ top: delta, behavior: "auto" });
  }, [offsets, rows]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { scrollTop, height } = metrics();
        setScrollPosition((current) => current.top === scrollTop && current.height === height ? current : { top: scrollTop, height });
      });
    };
    const host = scrollHost();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    host?.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      host?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const clearOutsideFocus = (event: PointerEvent) => {
      if (!content.contains(event.target as Node)) setPinnedRowKey(null);
    };
    window.addEventListener("pointerdown", clearOutsideFocus, { passive: true });
    return () => window.removeEventListener("pointerdown", clearOutsideFocus);
  }, []);

  if (!items.length) return null;
  return <div ref={contentRef} className={`${className} virtualized-rows`} style={{ height: offsets.at(-1) ?? 0 }}>
    {visibleIndexes.map((index) => {
      const row = rows[index];
      return <MeasuredRow key={row.key} row={row as VirtualRow<unknown>} top={offsets[index]} height={measured.get(row.key) ?? estimatedHeight + gap} columns={columns} gap={gap} onMeasure={onMeasure} renderItem={renderItem as (item: unknown) => ReactNode} getItemKey={getKey as (item: unknown) => string} onPin={setPinnedRowKey} />;
    })}
  </div>;
}
