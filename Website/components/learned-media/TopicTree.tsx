"use client";

import type { TopicNode } from "@/lib/types";
import type { TopicSearchIndex } from "@/lib/topic-search-types";
import type { RefCallback } from "react";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { selectionState } from "@/lib/topic-tree";
import { normalizeSearchText } from "@/lib/search";
import { Icon } from "./icons";

type TopicTreeProps = {
  nodes: TopicNode[];
  query?: string;
  catalogRevision: number;
  searchIndex?: TopicSearchIndex;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapseAll: () => void;
  onWeight: (id: string, delta: number) => void;
  onRemoveCustomTopic: (id: string) => void;
};

type VisibleTopic = { node: TopicNode; depth: number; root: boolean };

function topicSearchScore(query: string, value: string) {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedValue = normalizeSearchText(value);
  if (normalizedQuery.length < 2 || !normalizedValue) return 0;
  if (normalizedValue.includes(normalizedQuery)) return 100 + normalizedQuery.length;

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length > 1);
  const valueTokens = normalizedValue.split(" ").filter(Boolean);
  if (!queryTokens.length) return 0;

  let score = 0;
  for (const queryToken of queryTokens) {
    const matchingToken = valueTokens.find((token) => token.startsWith(queryToken));
    if (!matchingToken) return 0;
    score += matchingToken === queryToken ? 20 : 13;
  }
  return score + 12;
}

function makeFallbackIndex(nodes: TopicNode[], query: string, catalogRevision: number): TopicSearchIndex {
  const directScores = new Map<string, number>();
  const visibleIds = new Set<string>();
  const matchingDescendants = new Set<string>();
  const activeQuery = query.trim();
  if (!activeQuery) return { query: activeQuery, catalogRevision, directScores, visibleIds, matchingDescendants };

  const all: Array<{ node: TopicNode; parent?: string }> = [];
  const stack: Array<{ node: TopicNode; parent?: string }> = nodes.slice().reverse().map((node) => ({ node }));
  while (stack.length) {
    const entry = stack.pop()!;
    all.push(entry);
    for (const child of (entry.node.children ?? []).slice().reverse()) stack.push({ node: child, parent: entry.node.id });
  }
  const parents = new Map<string, string>();
  for (const entry of all) if (entry.parent) parents.set(entry.node.id, entry.parent);
  for (const { node } of all) {
    const score = Math.max(topicSearchScore(activeQuery, node.label), ...(node.aliases ?? []).map((alias) => topicSearchScore(activeQuery, alias)), 0);
    if (!score) continue;
    directScores.set(node.id, score);
    visibleIds.add(node.id);
    let parent = parents.get(node.id);
    while (parent) {
      visibleIds.add(parent);
      matchingDescendants.add(parent);
      parent = parents.get(parent);
    }
  }
  return { query: activeQuery, catalogRevision, directScores, visibleIds, matchingDescendants };
}

function visibleTopics(nodes: TopicNode[], query: string, searchIndex: TopicSearchIndex, searchExpansionSuppressed: boolean) {
  const rows: VisibleTopic[] = [];
  const activeQuery = query.trim();
  const stack = nodes.slice().reverse().map((node) => ({ node, depth: 0, root: true }));
  while (stack.length) {
    const row = stack.pop()!;
    if (activeQuery && !searchIndex.visibleIds.has(row.node.id)) continue;
    rows.push(row);
    const searchExpanded = activeQuery && searchIndex.matchingDescendants.has(row.node.id) && !searchExpansionSuppressed;
    if (row.node.children?.length && (row.node.expanded || searchExpanded)) {
      for (let index = row.node.children.length - 1; index >= 0; index -= 1) {
        stack.push({ node: row.node.children[index], depth: row.depth + 1, root: false });
      }
    }
  }
  return rows;
}

type RowProps = Pick<TopicTreeProps, "onToggle" | "onExpand" | "onWeight" | "onRemoveCustomTopic"> & {
  node: TopicNode;
  depth: number;
  root: boolean;
  query: string;
  searchIndex: TopicSearchIndex;
  top: number;
  height: number;
  onFocusTopic: (id: string) => void;
  onMeasure: (id: string, height: number) => void;
};

const TopicRow = memo(function TopicRow({ node, depth, root, query, searchIndex, top, height, onFocusTopic, onMeasure, onToggle, onExpand, onWeight, onRemoveCustomTopic }: RowProps) {
  const activeQuery = query.trim();
  const directSearchScore = searchIndex.directScores.get(node.id) ?? 0;
  const hasChildren = Boolean(node.children?.length);
  const state = selectionState(node);
  const childrenVisible = hasChildren && (node.expanded || Boolean(activeQuery && searchIndex.matchingDescendants.has(node.id)));
  const setMeasureRef = useCallback<RefCallback<HTMLDivElement>>((element) => {
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height;
      if (height) onMeasure(node.id, height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [node.id, onMeasure]);

  return <div ref={setMeasureRef} className="topic-virtual-row" style={{ top, minHeight: height }}>
    <div
      data-topic-search-score={directSearchScore || undefined}
      className={`topic-row ${root ? "root-row" : "leaf-row"} ${node.custom ? "custom-row" : ""} selection-${state}`}
      style={{ paddingLeft: `${Math.min(depth, 5) * 20 + 4}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-expanded={hasChildren ? childrenVisible : undefined}
      aria-selected={state === "selected"}
      onFocus={() => onFocusTopic(node.id)}
      onClick={(event) => { if ((event.target as HTMLElement).closest("button")) return; onToggle(node.id); }}
    >
      <button type="button" className="topic-expand" onClick={() => hasChildren && onExpand(node.id)} aria-label={`${node.expanded ? "Hide" : "Show"} Subtopics for ${node.label}`} aria-expanded={hasChildren ? childrenVisible : undefined} disabled={!hasChildren}>
        {hasChildren ? <Icon name={childrenVisible ? "chevronDown" : "chevronRight"} size={16} /> : <span className="topic-spacer" />}
      </button>
      <button type="button" className={`topic-check ${state === "selected" ? "checked" : ""} ${state === "mixed" ? "mixed" : ""}`} onClick={() => onToggle(node.id)} aria-pressed={state === "selected"} aria-label={`${state === "selected" ? "Deselect" : "Select"} ${node.label}`}>
        {state === "selected" && <Icon name="check" size={13} strokeWidth={3} />}
        {state === "mixed" && <span className="topic-check-dash" aria-hidden="true" />}
      </button>
      <div className={`topic-name-wrap ${state === "none" ? "unselected" : ""}`}>
        <span className={`topic-name ${state === "selected" ? "selected" : ""}`}>{node.label}</span>
        {hasChildren && <button type="button" className="topic-subtopics-toggle" onClick={() => onExpand(node.id)} aria-expanded={childrenVisible}>{childrenVisible ? "Hide Subtopics" : "Show Subtopics"}</button>}
      </div>
      {node.custom && <span className="custom-topic-actions"><span className="custom-mark">Custom</span><button type="button" className="topic-remove" onClick={() => onRemoveCustomTopic(node.id)} aria-label={`Delete custom topic ${node.label}`} title="Delete custom topic"><Icon name="trash" size={13} /></button></span>}
      <div className={`topic-weight ${state === "none" ? "disabled" : ""}`} aria-label={`${node.weight} weighting`}>
        <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, -5)} aria-label={`Decrease ${node.label} weight`}><Icon name="minus" size={13} /></button>
        <span className="topic-weight-value">{node.weight}</span>
        <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, 5)} aria-label={`Increase ${node.label} weight`}><Icon name="plus" size={13} /></button>
      </div>
    </div>
  </div>;
});

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

export function TopicTree({ nodes, query = "", catalogRevision, searchIndex: workerSearchIndex, onToggle, onExpand, onCollapseAll, onWeight, onRemoveCustomTopic }: TopicTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollQuery = useRef<string | null>(null);
  const [searchExpansionSuppressed, setSearchExpansionSuppressed] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(430);
  const [focusedTopicId, setFocusedTopicId] = useState<string | null>(null);
  const [measuredHeights, setMeasuredHeights] = useState<Map<string, number>>(() => new Map());
  const pendingAnchor = useRef<{ id: string; viewportOffset: number } | null>(null);
  const rowsRef = useRef<VisibleTopic[]>([]);
  const offsetsRef = useRef<number[]>([0]);
  const fallbackSearchIndex = useMemo(() => workerSearchIndex ? null : makeFallbackIndex(nodes, query, catalogRevision), [catalogRevision, nodes, query, workerSearchIndex]);
  const searchIndex = workerSearchIndex ?? fallbackSearchIndex ?? makeFallbackIndex([], "", catalogRevision);
  const isSearchReady = !query.trim() || searchIndex.ready !== false && searchIndex.query === query.trim() && searchIndex.catalogRevision === catalogRevision;
  const rows = useMemo(() => visibleTopics(nodes, query, searchIndex, searchExpansionSuppressed), [nodes, query, searchIndex, searchExpansionSuppressed]);
  const rowIndex = useMemo(() => new Map(rows.map((row, index) => [row.node.id, index])), [rows]);
  const offsets = useMemo(() => {
    const result = new Array<number>(rows.length + 1);
    result[0] = 0;
    for (let index = 0; index < rows.length; index += 1) result[index + 1] = result[index] + (measuredHeights.get(rows[index].node.id) ?? (rows[index].root ? 47 : 42));
    return result;
  }, [measuredHeights, rows]);
  rowsRef.current = rows;
  offsetsRef.current = offsets;
  const visibleRange = useMemo(() => {
    const overscan = Math.max(180, viewportHeight);
    const start = Math.max(0, lowerBound(offsets, Math.max(0, scrollTop - overscan)));
    const end = Math.min(rows.length, lowerBound(offsets, scrollTop + viewportHeight + overscan) + 2);
    return { start, end };
  }, [offsets, rows.length, scrollTop, viewportHeight]);
  const renderIndexes = useMemo(() => {
    const indexes = new Set<number>();
    for (let index = visibleRange.start; index < visibleRange.end; index += 1) indexes.add(index);
    const focused = focusedTopicId ? rowIndex.get(focusedTopicId) : undefined;
    if (focused !== undefined) indexes.add(focused);
    return [...indexes].sort((left, right) => left - right);
  }, [focusedTopicId, rowIndex, visibleRange]);
  const onMeasure = useCallback((id: string, height: number) => {
    setMeasuredHeights((current) => {
      const prior = current.get(id);
      if (prior !== undefined && Math.abs(prior - height) < 1) return current;
      const currentRows = rowsRef.current;
      const currentOffsets = offsetsRef.current;
      if (!pendingAnchor.current && currentRows.length) {
        const tree = treeRef.current;
        const top = tree?.scrollTop ?? 0;
        const anchorIndex = Math.min(currentRows.length - 1, lowerBound(currentOffsets, top));
        pendingAnchor.current = { id: currentRows[anchorIndex].node.id, viewportOffset: currentOffsets[anchorIndex] - top };
      }
      const next = new Map(current);
      next.set(id, height);
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const tree = treeRef.current;
    const index = rowIndex.get(anchor.id);
    if (!tree || index === undefined) return;
    tree.scrollTop = Math.max(0, offsets[index] - anchor.viewportOffset);
  }, [offsets, rowIndex]);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const updateSize = () => setViewportHeight(tree.clientHeight || 430);
    updateSize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateSize);
    observer?.observe(tree);
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    setSearchExpansionSuppressed(false);
    lastAutoScrollQuery.current = null;
  }, [query]);

  useEffect(() => {
    const tree = treeRef.current;
    const activeQuery = query.trim();
    if (!tree || !activeQuery || !isSearchReady || lastAutoScrollQuery.current === activeQuery) return;
    lastAutoScrollQuery.current = activeQuery;
    const best = [...searchIndex.directScores].sort((left, right) => right[1] - left[1])[0]?.[0];
    const index = best ? rowIndex.get(best) : undefined;
    if (index !== undefined) tree.scrollTo({ top: Math.max(0, offsets[index] - tree.clientHeight / 2), behavior: "smooth" });
  }, [isSearchReady, offsets, query, rowIndex, searchIndex]);

  const hasMatches = !query.trim() || rows.length > 0;

  return <div className="topic-tree-picker">
    <div className="topic-tree-actions"><button type="button" className="topic-tree-collapse-button" onClick={() => { setSearchExpansionSuppressed(true); onCollapseAll(); }} aria-label="Collapse all topic branches">Collapse all</button></div>
    <div className="topic-tree" role="tree" aria-label="Topic browser" ref={treeRef} onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      {query.trim() && !isSearchReady ? <p className="topic-tree-empty" role="status">Searching topics…</p>
        : query.trim() && !hasMatches ? <p className="topic-tree-empty" role="status">No topics found for “{query.trim()}”.</p>
          : <div className="topic-virtual-content" style={{ height: offsets.at(-1) ?? 0 }}>
            {renderIndexes.map((index) => {
              const entry = rows[index];
              return <TopicRow key={entry.node.id} node={entry.node} depth={entry.depth} root={entry.root} query={query} searchIndex={searchIndex} top={offsets[index]} height={measuredHeights.get(entry.node.id) ?? (entry.root ? 47 : 42)} onFocusTopic={setFocusedTopicId} onMeasure={onMeasure} onToggle={onToggle} onExpand={onExpand} onWeight={onWeight} onRemoveCustomTopic={onRemoveCustomTopic} />;
            })}
          </div>}
    </div>
  </div>;
}
