"use client";

import { useSyncExternalStore } from "react";
import { APPROVED_YOUTUBE_CHANNELS, createYouTubeProgressStore, type YouTubeImportProgress } from "@/lib/youtube";

const initialProgress: YouTubeImportProgress = {
  phase: "idle",
  completedChannels: 0,
  totalChannels: APPROVED_YOUTUBE_CHANNELS.length,
  importedVideos: 0,
  completedSources: 0
};

const store = createYouTubeProgressStore(initialProgress);

export function publishYouTubeImportProgress(progress: YouTubeImportProgress, immediate = false) {
  // Import implementations mutate their working progress object between callbacks.
  // Keep the deferred snapshot immutable for this frame.
  store.publish({ ...progress }, immediate);
}

export function updateYouTubeImportProgress(change: (current: YouTubeImportProgress) => YouTubeImportProgress, immediate = false) {
  store.update((current) => ({ ...change(current) }), immediate);
}

export function useYouTubeImportProgress() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
}
