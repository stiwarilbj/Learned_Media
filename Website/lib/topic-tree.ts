import type { TopicNode } from "./types";
import { preserveTopicPathIndex, preserveTopicSelectionStats, updateTopicTreeById } from "./topic-catalog";

export {
  flattenTopics,
  migrateTopicTree,
  selectWeightedTopicPaths,
  selectedLeafCount,
  selectedLeafTopics,
  selectionState,
  summarizeSelection,
  toggleTopicSelection
} from "./topic-catalog";

export function updateTopicTree(
  nodes: TopicNode[],
  id: string,
  update: (node: TopicNode) => TopicNode
): TopicNode[] {
  return updateTopicTreeById(nodes, id, update);
}

export function collapseTopicBranches(nodes: TopicNode[]): TopicNode[] {
  let changed = false;
  const next = nodes.map((node) => {
    const children = node.children ? collapseTopicBranches(node.children) : node.children;
    if (!node.expanded && children === node.children) return node;
    changed = true;
    return preserveTopicSelectionStats(node, { ...node, expanded: false, children });
  });
  return changed ? preserveTopicPathIndex(nodes, next) : nodes;
}

export function removeTopicTree(nodes: TopicNode[], id: string): TopicNode[] {
  let changed = false;
  const result: TopicNode[] = [];
  for (const node of nodes) {
    if (node.id === id) { changed = true; continue; }
    if (!node.children?.length) { result.push(node); continue; }
    const children = removeTopicTree(node.children, id);
    if (children !== node.children) { changed = true; result.push({ ...node, children }); }
    else result.push(node);
  }
  return changed ? preserveTopicPathIndex(nodes, result) : nodes;
}

export function clearTopicSelections(nodes: TopicNode[]): TopicNode[] {
  const cleared = nodes.map((node) => ({
    ...node,
    selected: false,
    children: node.children ? clearTopicSelections(node.children) : undefined
  }));
  return preserveTopicPathIndex(nodes, cleared);
}
