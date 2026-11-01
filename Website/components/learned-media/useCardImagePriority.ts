"use client";

import { useCallback, useEffect, useRef } from "react";
import { cardImagePriorityForBounds, type CardImagePriority } from "@/lib/card-image-cache";
import type { DisplayMode, FactCard } from "@/lib/types";

type PriorityListener = (workspaceId: string, card: FactCard, priority: CardImagePriority | null) => void;

/** Reports only image-bearing cards in or near the reader's retained viewport. */
export function useCardImagePriority(workspaceId: string, displayMode: DisplayMode, onPriorityChange: PriorityListener) {
  const retainedCards = useRef<readonly FactCard[]>([]);
  const reported = useRef(new Map<string, { workspaceId: string; card: FactCard; priority: CardImagePriority }>());
  const callback = useRef(onPriorityChange);
  callback.current = onPriorityChange;

  const refresh = useCallback(() => {
    const host = document.querySelector<HTMLElement>(".main-scroll");
    const overflowY = host ? getComputedStyle(host).overflowY : "";
    const scrollHost = host && (overflowY === "auto" || overflowY === "scroll") ? host : null;
    const viewport = scrollHost ? scrollHost.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
    const articles = new Map<string, HTMLElement>();
    document.querySelectorAll<HTMLElement>("[data-fact-card-id]").forEach(element => {
      if (element.dataset.factCardId) articles.set(element.dataset.factCardId, element);
    });

    const next = new Map<string, { workspaceId: string; card: FactCard; priority: CardImagePriority }>();
    for (const card of retainedCards.current) {
      if ((card.displayModeOverride ?? displayMode) !== "picture-text" || card.image || !card.sources?.[0]) continue;
      const article = articles.get(card.id);
      if (!article) continue;
      const priority = cardImagePriorityForBounds(article.getBoundingClientRect(), viewport, article.contains(document.activeElement));
      if (priority) next.set(`${workspaceId}\u0000${card.id}`, { workspaceId, card, priority });
    }

    for (const [id, previous] of reported.current) {
      const current = next.get(id);
      if (!current) callback.current(previous.workspaceId, previous.card, null);
      else if (current.card !== previous.card || current.priority !== previous.priority) callback.current(current.workspaceId, current.card, current.priority);
    }
    for (const [id, current] of next) if (!reported.current.has(id)) callback.current(current.workspaceId, current.card, current.priority);
    reported.current = next;
  }, [displayMode, workspaceId]);

  const frame = useRef(0);
  const scheduleRefresh = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      refresh();
    });
  }, [refresh]);

  const retainItems = useCallback((items: readonly FactCard[]) => {
    retainedCards.current = items;
    scheduleRefresh();
  }, [scheduleRefresh]);

  useEffect(() => {
    const host = document.querySelector<HTMLElement>(".main-scroll");
    const overflowY = host ? getComputedStyle(host).overflowY : "";
    const scrollHost = host && (overflowY === "auto" || overflowY === "scroll") ? host : null;
    window.addEventListener("scroll", scheduleRefresh, { passive: true });
    window.addEventListener("resize", scheduleRefresh, { passive: true });
    scrollHost?.addEventListener("scroll", scheduleRefresh, { passive: true });
    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(scheduleRefresh) : null;
    if (scrollHost) resizeObserver?.observe(scrollHost);
    scheduleRefresh();
    return () => {
      window.removeEventListener("scroll", scheduleRefresh);
      window.removeEventListener("resize", scheduleRefresh);
      scrollHost?.removeEventListener("scroll", scheduleRefresh);
      resizeObserver?.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      for (const { workspaceId: cardWorkspaceId, card } of reported.current.values()) callback.current(cardWorkspaceId, card, null);
      reported.current.clear();
      retainedCards.current = [];
    };
  }, [scheduleRefresh]);

  return retainItems;
}
