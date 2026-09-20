"use client";

import type { TopicNode } from "@/lib/types";
import type { CSSProperties } from "react";
import { selectionState } from "@/lib/topic-tree";
import { Icon } from "./icons";

type TopicTreeProps = {
  nodes: TopicNode[];
  query?: string;
  onToggle: (id: string) => void;
  onExpand: (id: string) => void;
  onWeight: (id: string, delta: number) => void;
};

function matchesNode(node: TopicNode, query: string): boolean {
  if (!query) return true;
  const term = query.toLowerCase();
  return node.label.toLowerCase().includes(term) || Boolean(node.children?.some((child) => matchesNode(child, query)));
}

function TopicRow({ node, depth, query, onToggle, onExpand, onWeight }: TopicTreeProps & { node: TopicNode; depth: number }) {
  if (!matchesNode(node, query ?? "")) return null;
  const hasChildren = Boolean(node.children?.length);
  const state = selectionState(node);
  const isSearchExpanded = Boolean(query && node.children?.some((child) => matchesNode(child, query)));
  const childrenVisible = hasChildren && (node.expanded || isSearchExpanded);

  return (
    <div className="topic-branch">
      <div className={`topic-row ${depth === 0 ? "root-row" : ""} selection-${state}`} style={{ paddingLeft: `${Math.min(depth, 5) * 20 + 4}px` }}>
        <button
          type="button"
          className="topic-expand"
          onClick={() => hasChildren && onExpand(node.id)}
          aria-label={`${node.expanded ? "Hide" : "Show"} subtopics for ${node.label}`}
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
          {hasChildren && <button type="button" className="topic-subtopics-toggle" onClick={() => onExpand(node.id)} aria-expanded={childrenVisible}>{childrenVisible ? "Hide subtopics" : "Show subtopics"}</button>}
        </div>
        <div className={`topic-weight ${state === "none" ? "disabled" : ""}`} aria-label={`${node.weight} weighting`}>
          <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, -5)} aria-label={`Decrease ${node.label} weight`}>
            <Icon name="minus" size={13} />
          </button>
          <span className="topic-weight-value">{node.weight}</span>
          <button type="button" disabled={state === "none"} onClick={() => onWeight(node.id, 5)} aria-label={`Increase ${node.label} weight`}>
            <Icon name="plus" size={13} />
          </button>
        </div>
        {node.custom && <span className="custom-mark">Custom</span>}
      </div>
      {childrenVisible && (
        <div className="topic-children" style={{ "--guide-left": `${Math.min(depth + 1, 5) * 20 + 28}px` } as CSSProperties}>
          {node.children?.map((child) => (
            <TopicRow
              key={child.id}
              node={child}
              depth={depth + 1}
              nodes={[]}
              query={query}
              onToggle={onToggle}
              onExpand={onExpand}
              onWeight={onWeight}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicTree({ nodes, query = "", onToggle, onExpand, onWeight }: TopicTreeProps) {
  return (
    <div className="topic-tree" role="tree" aria-label="Topic browser">
      {nodes.map((node) => (
        <TopicRow key={node.id} node={node} depth={0} nodes={nodes} query={query} onToggle={onToggle} onExpand={onExpand} onWeight={onWeight} />
      ))}
    </div>
  );
}
