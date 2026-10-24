"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  activeDownloadTags,
  DOWNLOAD_MODES,
  DOWNLOAD_PREFERENCE_KEY,
  downloadFormat,
  normalizeDownloadMode,
  prepareDownloadNames,
  snapshotDownloadCards,
  type DownloadMode,
} from "@/lib/fact-downloads";
import type { FactCard, TopicNode } from "@/lib/types";
import type { FactExportResult } from "@/lib/exports";
type Downloads = {
  mode: DownloadMode;
  setMode: (mode: DownloadMode) => void;
  busy: boolean;
  status: string;
  start: (cards: FactCard[], individual?: boolean) => void;
  cancel: () => void;
  ready: { result: FactExportResult; jobId: number; scope: string } | null;
  scope: string;
  save: () => void;
  total: number;
  session: () => void;
};
const Context = createContext<Downloads | null>(null);
export function useCardDownloads() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing download provider");
  return value;
}
export function CardDownloadsProvider({
  workspaceId,
  accountId,
  workspaceName,
  cards,
  topics,
  children,
}: {
  workspaceId: string;
  accountId?: string;
  workspaceName: string;
  cards: FactCard[];
  topics: TopicNode[];
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<DownloadMode>("pdf-single"),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [ready, setReady] = useState<Downloads["ready"]>(null);
  const activeJob = useRef<{
      controller: AbortController;
      id: number;
      scope: string;
    } | null>(null),
    jobSequence = useRef(0),
    scopeRef = useRef("");
  const scope = `${workspaceId}\u0000${accountId ?? "local"}`;
  scopeRef.current = scope;
  const setMode = useCallback((value: DownloadMode) => {
    const next = normalizeDownloadMode(value);
    setModeState(next);
    try {
      localStorage.setItem(DOWNLOAD_PREFERENCE_KEY, next);
    } catch {}
  }, []);
  const cancel = useCallback(() => {
    jobSequence.current += 1;
    activeJob.current?.controller.abort();
    activeJob.current = null;
    setBusy(false);
    setReady(null);
    setStatus("Download canceled.");
  }, []);
  useEffect(() => {
    try {
      setModeState(
        normalizeDownloadMode(localStorage.getItem(DOWNLOAD_PREFERENCE_KEY)),
      );
    } catch {}
    const reset = () => setMode("pdf-single");
    window.addEventListener("learned-media-reset-downloads", reset);
    return () =>
      window.removeEventListener("learned-media-reset-downloads", reset);
  }, [setMode]);
  useEffect(() => {
    cancel();
    setStatus("");
    return () => {
      jobSequence.current += 1;
      activeJob.current?.controller.abort();
      activeJob.current = null;
    };
  }, [workspaceId, accountId, cancel]);
  const save = useCallback(async () => {
    const prepared = ready;
    if (!prepared || prepared.scope !== scopeRef.current || prepared.jobId !== jobSequence.current) return;
    try {
      const { downloadBlob } = await import("@/lib/exports");
      if (prepared.scope !== scopeRef.current || prepared.jobId !== jobSequence.current) return;
      downloadBlob(prepared.result.blob, prepared.result.filename);
    } catch {
      if (prepared.scope === scopeRef.current && prepared.jobId === jobSequence.current)
        setStatus("The prepared download could not be opened. Prepare it again.");
    }
  }, [ready]);
  const start = useCallback(
    async (input: FactCard[], individual = false) => {
      if (activeJob.current || !input.length) return;
      const snapshot = snapshotDownloadCards(input),
        tagNames = activeDownloadTags(topics),
        controller = new AbortController(),
        id = ++jobSequence.current,
        job = { controller, id, scope: scopeRef.current },
        naming = prepareDownloadNames(mode, snapshot, tagNames, individual);
      activeJob.current = job;
      setBusy(true);
      setReady(null);
      setStatus(`Preparing ${naming.filename} · ${snapshot.length} cards…`);
      try {
        const { buildFactExport, downloadBlob } = await import("@/lib/exports");
        job.controller.signal.throwIfAborted();
        if (activeJob.current !== job || job.scope !== scopeRef.current) return;
        const result = await buildFactExport(mode, workspaceName, snapshot, {
          individual,
          tagNames,
          signal: job.controller.signal,
          onProgress: (message) => {
            if (activeJob.current === job && job.scope === scopeRef.current) setStatus(message);
          },
        });
        job.controller.signal.throwIfAborted();
        if (activeJob.current !== job || job.scope !== scopeRef.current || job.id !== jobSequence.current) return;
        setReady({ result, jobId: job.id, scope: job.scope });
        downloadBlob(result.blob, result.filename);
        setStatus(
          `Ready: ${result.filename} · ${result.cardCount} card${result.cardCount === 1 ? "" : "s"}${result.omittedImages.length ? ` · ${result.omittedImages.length} picture${result.omittedImages.length === 1 ? "" : "s"} unavailable; all text and sources retained` : " · all pictures and sources included"}.`,
        );
      } catch (error) {
        if (activeJob.current === job && job.scope === scopeRef.current)
          setStatus(
            job.controller.signal.aborted
              ? "Download canceled."
              : error instanceof Error
                ? error.message
                : "Download could not be prepared.",
          );
      } finally {
        if (activeJob.current === job) {
          activeJob.current = null;
          setBusy(false);
        }
      }
    },
    [mode, workspaceName, topics],
  );
  return (
    <Context.Provider
      value={{
        mode,
        setMode,
        busy,
        status,
        start,
        cancel,
        ready,
        scope,
        save,
        total: cards.length,
        session: () => start(cards),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function DownloadFeedback() {
  const d = useCardDownloads();
  const ready = d.ready?.scope === d.scope ? d.ready : null;
  return (
    <div className="download-feedback" aria-live="polite">
      {d.status && <span role="status">{d.status}</span>}
      {d.busy && (
        <button type="button" className="ghost-button" onClick={d.cancel}>
          Cancel download
        </button>
      )}
      {ready && !d.busy && (
        <button type="button" className="ghost-button" onClick={d.save}>
          Download file
        </button>
      )}
    </div>
  );
}
export function DownloadSession() {
  const d = useCardDownloads();
  return (
    <div className="session-download">
      <button
        type="button"
        className="ghost-button"
        disabled={!d.total || d.busy}
        onClick={d.session}
      >
        Download session
      </button>
      <DownloadFeedback />
    </div>
  );
}
export function DownloadSettings({ cards }: { cards: FactCard[] }) {
  const d = useCardDownloads(),
    [collection, setCollection] = useState("all");
  const selected =
    collection === "saved" ? cards.filter((c) => c.saved) : cards;
  return (
    <>
      <div className="export-controls">
        <label className="field-label" htmlFor="export-collection">
          Collection
        </label>
        <select
          id="export-collection"
          value={collection}
          onChange={(e) => setCollection(e.target.value)}
        >
          <option value="all">All cards ({cards.length})</option>
          <option value="saved">
            Saved Facts ({cards.filter((c) => c.saved).length})
          </option>
        </select>
        <label className="field-label" htmlFor="download-mode">
          Download format
        </label>
        <select
          id="download-mode"
          value={d.mode}
          onChange={(e) => d.setMode(e.target.value as DownloadMode)}
        >
          {DOWNLOAD_MODES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="secondary-button"
          disabled={!selected.length || d.busy}
          onClick={() => d.start(selected)}
        >
          Download cards
        </button>
      </div>
      <DownloadFeedback />
    </>
  );
}
export function DownloadCardMenuItem({
  card,
  close,
}: {
  card: FactCard;
  close: () => void;
}) {
  const d = useCardDownloads();
  return (
    <button
      type="button"
      role="menuitem"
      disabled={d.busy}
      onClick={() => {
        close();
        d.start([card], true);
      }}
    >
      Download card ({downloadFormat(d.mode).toUpperCase()})
    </button>
  );
}
