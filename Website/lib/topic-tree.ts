import type { TopicNode } from "./types";

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

export function flattenTopics(nodes: TopicNode[], parentPath: string[] = []): Array<TopicNode & { path: string[] }> {
  return nodes.flatMap((node) => {
    const path = [...parentPath, node.label];
    return [{ ...node, path }, ...(node.children ? flattenTopics(node.children, path) : [])];
  });
}

export function selectedTopics(nodes: TopicNode[]) {
  return flattenTopics(nodes).filter((topic) => topic.selected);
}

export function clearTopicSelections(nodes: TopicNode[]): TopicNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: false,
    expanded: false,
    children: node.children ? clearTopicSelections(node.children) : undefined
  }));
}
