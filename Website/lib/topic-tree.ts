import type { TopicNode } from "./types";

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
  return nodes.map((node) => {
    const next = node.id === id ? update(node) : node;
    return next.children ? { ...next, children: updateTopicTree(next.children, id, update) } : next;
  });
}

export function collapseTopicBranches(nodes: TopicNode[]): TopicNode[] {
  return nodes.map((node) => {
    const collapsed = { ...node, expanded: false };
    if (node.children) collapsed.children = collapseTopicBranches(node.children);
    return collapsed;
  });
}

export function removeTopicTree(nodes: TopicNode[], id: string): TopicNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => node.children ? { ...node, children: removeTopicTree(node.children, id) } : node);
}

export function clearTopicSelections(nodes: TopicNode[]): TopicNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: false,
    children: node.children ? clearTopicSelections(node.children) : undefined
  }));
}
