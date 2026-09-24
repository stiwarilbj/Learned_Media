"use client";

import type { TopicNode } from "@/lib/types";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { selectionState } from "@/lib/topic-tree";
import { normalizeSearchText } from "@/lib/search";
import { Icon } from "./icons";

type TopicTreeProps = {
  nodes: TopicNode[];
  query?: string;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  onCollapseAll: () => void;
  onWeight: (id: string, delta: number) => void;
  onRemoveCustomTopic: (id: string) => void;
};

type TopicSearchIndex = {
  directScores: Map<string, number>;
  matchingNodes: Set<string>;
  matchingDescendants: Set<string>;
};

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

function buildTopicSearchIndex(nodes: TopicNode[], query: string): TopicSearchIndex {
  const directScores = new Map<string, number>();
  const matchingNodes = new Set<string>();
  const matchingDescendants = new Set<string>();
  const activeQuery = query.trim();
  if (!activeQuery) return { directScores, matchingNodes, matchingDescendants };

  const visit = (node: TopicNode): boolean => {
    const directScore = Math.max(
      topicSearchScore(activeQuery, node.label),
      ...(node.aliases ?? []).map((alias) => topicSearchScore(activeQuery, alias)),
      0,
    );
    if (directScore > 0) directScores.set(node.id, directScore);

    const hasMatchingDescendant = node.children?.map(visit).some(Boolean) ?? false;
    if (directScore > 0 || hasMatchingDescendant) matchingNodes.add(node.id);
    if (hasMatchingDescendant) matchingDescendants.add(node.id);
    return directScore > 0 || hasMatchingDescendant;
  };

  nodes.forEach(visit);
  return { directScores, matchingNodes, matchingDescendants };
}

type TopicRowProps = Pick<TopicTreeProps, "onToggle" | "onExpand" | "onWeight" | "onRemoveCustomTopic"> & {
  node: TopicNode;
  depth: number;
  query: string;
  searchIndex: TopicSearchIndex;
  searchExpansionSuppressed: boolean;
};

function TopicRow({ node, depth, query, searchIndex, searchExpansionSuppressed, onToggle, onExpand, onWeight, onRemoveCustomTopic }: TopicRowProps) {
  const activeQuery = query?.trim() ?? "";
  const directSearchScore = searchIndex.directScores.get(node.id) ?? 0;
  if (activeQuery && !searchIndex.matchingNodes.has(node.id)) return null;
  const hasChildren = Boolean(node.children?.length);
  const state = selectionState(node);
  const isSearchExpanded = Boolean(activeQuery && searchIndex.matchingDescendants.has(node.id));
  const childrenVisible = hasChildren && (node.expanded || (isSearchExpanded && !searchExpansionSuppressed));

  return (
    <div className="topic-branch">
      <div data-topic-search-score={directSearchScore || undefined} className={`topic-row ${depth === 0 ? "root-row" : ""} ${!hasChildren ? "leaf-row" : ""} ${node.custom ? "custom-row" : ""} selection-${state}`} style={{ paddingLeft: `${Math.min(depth, 5) * 20 + 4}px` }} onClick={(event) => { if ((event.target as HTMLElement).closest("button")) return; onToggle(node.id); }}>
        <button
          type="button"
          className="topic-expand"
          onClick={() => hasChildren && onExpand(node.id)}
          aria-label={`${node.expanded ? "Hide" : "Show"} Subtopics for ${node.label}`}
          aria-expanded={hasChildren ? childrenVisible : undefined}
          disabled={!hasChildren}
        >
          {hasChildren ? <Icon name={childrenVisible ? "chevronDown" : "chevronRight"} size={16} /> : <span className="topic-spacer" />}
        </button>
        <button
          type="button"
          className={`topic-check ${state === "selected" ? "checked" : ""} ${state === "mixed" ? "mixed" : ""}`}
          onClick={() => onToggle(node.id)}
          aria-pressed={state === "selected"}
          aria-label={`${state === "selected" ? "Deselect" : "Select"} ${node.label}`}
        >
          {state === "selected" && <Icon name="check" size={13} strokeWidth={3} />}
          {state === "mixed" && <span className="topic-check-dash" aria-hidden="true" />}
        </button>
        <div className={`topic-name-wrap ${state === "none" ? "unselected" : ""}`}>
          <span className={`topic-name ${state === "selected" ? "selected" : ""}`}>{node.label}</span>
          {hasChildren && <button type="button" className="topic-subtopics-toggle" onClick={() => onExpand(node.id)} aria-expanded={childrenVisible}>{childrenVisible ? "Hide Subtopics" : "Show Subtopics"}</button>}
        </div>
        {node.custom && <span className="custom-topic-actions"><span className="custom-mark">Custom</span><button type="button" className="topic-remove" onClick={() => onRemoveCustomTopic(node.id)} aria-label={`Delete custom topic ${node.label}`} title="Delete custom topic"><Icon name="trash" size={13} /></button></span>}
        <div className={`topic-weight ${state === "none" ? "disabled" : ""}`} aria-label={`${node.weight} weighting`}>
          <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, -5)} aria-label={`Decrease ${node.label} weight`}>
            <Icon name="minus" size={13} />
          </button>
          <span className="topic-weight-value">{node.weight}</span>
          <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, 5)} aria-label={`Increase ${node.label} weight`}>
            <Icon name="plus" size={13} />
          </button>
        </div>
      </div>
      {childrenVisible && (
        <div className="topic-children" style={{ "--guide-left": `${Math.min(depth + 1, 5) * 20 + 28}px` } as CSSProperties}>
          {node.children?.map((child) => (
            <TopicRow
              key={child.id}
              node={child}
              depth={depth + 1}
              query={query}
              searchIndex={searchIndex}
              searchExpansionSuppressed={searchExpansionSuppressed}
              onToggle={onToggle}
              onExpand={onExpand}
              onWeight={onWeight}
              onRemoveCustomTopic={onRemoveCustomTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicTree({ nodes, query = "", onToggle, onExpand, onCollapseAll, onWeight, onRemoveCustomTopic }: TopicTreeProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollQuery = useRef<string | null>(null);
  const [searchExpansionSuppressed, setSearchExpansionSuppressed] = useState(false);
  const searchIndex = useMemo(() => buildTopicSearchIndex(nodes, query), [nodes, query]);
  const hasMatches = !query.trim() || nodes.some((node) => searchIndex.matchingNodes.has(node.id));

  useEffect(() => {
    setSearchExpansionSuppressed(false);
  }, [query]);

  useEffect(() => {
    const tree = treeRef.current;
    if (!tree) return;
    const activeQuery = query.trim();
    if (lastAutoScrollQuery.current === activeQuery) return;
    lastAutoScrollQuery.current = activeQuery;
    if (!activeQuery) {
      tree.scrollTop = 0;
      return;
    }

    const candidates = tree.querySelectorAll<HTMLElement>("[data-topic-search-score]");
    const target = Array.from(candidates).sort((left, right) => (
      Number(right.dataset.topicSearchScore ?? 0) - Number(left.dataset.topicSearchScore ?? 0)
    ))[0] ?? null;
    if (!target || !hasMatches) return;

    const treeRect = tree.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    if (tree.scrollHeight > tree.clientHeight) {
      const targetTop = tree.scrollTop + targetRect.top - treeRect.top;
      tree.scrollTo({
        top: targetTop - (tree.clientHeight - targetRect.height) / 2,
        behavior: "smooth",
      });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [hasMatches, query, searchIndex]);

  return (
    <div className="topic-tree-picker">
      <div className="topic-tree-actions">
        <button type="button" className="topic-tree-collapse-button" onClick={() => { setSearchExpansionSuppressed(true); onCollapseAll(); }} aria-label="Collapse all topic branches">Collapse all</button>
      </div>
      <div className="topic-tree" role="tree" aria-label="Topic browser" ref={treeRef}>
        {query.trim() && !hasMatches
          ? <p className="topic-tree-empty" role="status">No topics found for “{query.trim()}”.</p>
          : nodes.map((node) => (
            <TopicRow key={node.id} node={node} depth={0} query={query} searchIndex={searchIndex} searchExpansionSuppressed={searchExpansionSuppressed} onToggle={onToggle} onExpand={onExpand} onWeight={onWeight} onRemoveCustomTopic={onRemoveCustomTopic} />
          ))}
      </div>
    </div>
  );
}
