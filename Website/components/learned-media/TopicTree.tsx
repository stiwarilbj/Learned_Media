"use client";

import type { TopicNode } from "@/lib/types";
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

  return (
    <div className="topic-branch">
      <div className={`topic-row ${depth === 0 ? "root-row" : ""}`} style={{ paddingLeft: `${depth * 24}px` }}>
        <button
          type="button"
          className="topic-expand"
          onClick={() => hasChildren && onExpand(node.id)}
          aria-label={`${node.expanded ? "Collapse" : "Expand"} ${node.label}`}
          disabled={!hasChildren}
        >
          {hasChildren ? <Icon name={node.expanded ? "chevronDown" : "chevronRight"} size={16} /> : <span className="topic-spacer" />}
        </button>
        <button
          type="button"
          className={`topic-check ${node.selected ? "checked" : ""}`}
          onClick={() => onToggle(node.id)}
          aria-pressed={node.selected}
          aria-label={`${node.selected ? "Deselect" : "Select"} ${node.label}`}
        >
          {node.selected && <Icon name="check" size={13} strokeWidth={3} />}
        </button>
        <span className={`topic-name ${node.selected ? "selected" : ""}`}>{node.label}</span>
        <div className="topic-weight" aria-label={`${node.weight}% weighting`}>
          <button type="button" onClick={() => onWeight(node.id, -5)} aria-label={`Decrease ${node.label} weight`}>
            <Icon name="minus" size={13} />
          </button>
          <span>{node.weight}%</span>
          <button type="button" onClick={() => onWeight(node.id, 5)} aria-label={`Increase ${node.label} weight`}>
            <Icon name="plus" size={13} />
          </button>
        </div>
        {node.custom && <span className="custom-mark">Custom</span>}
      </div>
      {hasChildren && node.expanded && (
        <div className="topic-children">
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
