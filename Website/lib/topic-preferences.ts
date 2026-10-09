import { createCatalogTopics, preserveTopicPathIndex } from "./topic-catalog";
import type { TopicNode } from "./types";

export type CompactTopicPreferences = {
  format: "learned-media-topic-preferences-v1";
  selected: string[];
  expanded: string[];
  weights: Record<string, number>;
  custom: TopicNode[];
};

const compactPreferencesByTree = new WeakMap<TopicNode[], CompactTopicPreferences>();

export function compactTopicPreferences(nodes: TopicNode[]): CompactTopicPreferences {
  const cached = compactPreferencesByTree.get(nodes);
  if (cached) return cached;
  const selected: string[] = [];
  const expanded: string[] = [];
  const weights: Record<string, number> = {};
  const custom: TopicNode[] = [];
  const visit = (items: TopicNode[], parentSelected = false) => {
    for (const node of items) {
      if (node.custom) {
        custom.push(node);
        continue;
      }
      if (node.selected && !parentSelected) selected.push(node.id);
      if (node.expanded) expanded.push(node.id);
      if (node.weight !== 10) weights[node.id] = node.weight;
      visit(node.children ?? [], parentSelected || node.selected);
    }
  };
  visit(nodes);
  const compact = { format: "learned-media-topic-preferences-v1" as const, selected, expanded, weights, custom };
  compactPreferencesByTree.set(nodes, compact);
  return compact;
}

export function restoreTopicPreferences(value: unknown, collapseExpanded = false, catalogTopics?: TopicNode[]): TopicNode[] | null {
  if (!value || typeof value !== "object" || (value as { format?: string }).format !== "learned-media-topic-preferences-v1") return null;
  const preferences = value as CompactTopicPreferences;
  const selected = new Set(Array.isArray(preferences.selected) ? preferences.selected : []);
  const expanded = new Set(Array.isArray(preferences.expanded) ? preferences.expanded : []);
  const weights = preferences.weights && typeof preferences.weights === "object" ? preferences.weights : {};
  const custom = Array.isArray(preferences.custom) ? preferences.custom : [];
  const sourceCatalog = catalogTopics ?? createCatalogTopics();
  if (!collapseExpanded && !selected.size && !expanded.size && !Object.keys(weights).length) {
    return custom.length ? preserveTopicPathIndex(sourceCatalog, [...sourceCatalog, ...custom]) : sourceCatalog;
  }

  const apply = (items: TopicNode[], inheritedSelection = false): TopicNode[] => {
    let changed = false;
    const result = items.map((node) => {
      const isSelected = inheritedSelection || selected.has(node.id);
      const children = node.children?.length ? apply(node.children, isSelected) : node.children;
      const nextSelected = children?.length ? children.every((child) => child.selected) : isSelected;
      const nextExpanded = !collapseExpanded && expanded.has(node.id);
      const storedWeight = weights[node.id];
      const nextWeight = Number.isFinite(storedWeight) ? storedWeight : node.weight;
      if (nextSelected === node.selected && nextExpanded === node.expanded && nextWeight === node.weight && children === node.children) return node;
      changed = true;
      return { ...node, selected: nextSelected, expanded: nextExpanded, weight: nextWeight, children };
    });
    return changed ? result : items;
  };
  const catalog = apply(sourceCatalog);
  const restored = custom.length ? [...catalog, ...custom] : catalog;
  return preserveTopicPathIndex(sourceCatalog, restored);
}
