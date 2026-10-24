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
  DOWNLOAD_MODES,
  DOWNLOAD_PREFERENCE_KEY,
  downloadFormat,
  normalizeDownloadMode,
  snapshotDownloadCards,
  type DownloadMode,
} from "@/lib/fact-downloads";
import type { FactCard } from "@/lib/types";
import type { FactExportResult } from "@/lib/exports";
type Downloads = {
  mode: DownloadMode;
  setMode: (mode: DownloadMode) => void;
  busy: boolean;
  status: string;
  start: (cards: FactCard[], individual?: boolean) => void;
  cancel: () => void;
  ready: FactExportResult | null;
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
  children,
}: {
  workspaceId: string;
  accountId?: string;
  workspaceName: string;
  cards: FactCard[];
  children: ReactNode;
}) {
  const [mode, setModeState] = useState<DownloadMode>("pdf-single"),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [ready, setReady] = useState<FactExportResult | null>(null);
  const controller = useRef<AbortController | null>(null),
    resultRef = useRef<FactExportResult | null>(null);
  const setMode = useCallback((value: DownloadMode) => {
    const next = normalizeDownloadMode(value);
    setModeState(next);
    try {
      localStorage.setItem(DOWNLOAD_PREFERENCE_KEY, next);
    } catch {}
  }, []);
  const cancel = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setReady(null);
    resultRef.current = null;
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
      controller.current?.abort();
      controller.current = null;
      resultRef.current = null;
    };
  }, [workspaceId, accountId, cancel]);
  const save = useCallback(() => {
    const result = resultRef.current;
    if (result)
      void import("@/lib/exports").then(({ downloadBlob }) =>
        downloadBlob(result.blob, result.filename),
      );
  }, []);
  const start = useCallback(
    async (input: FactCard[], individual = false) => {
      if (controller.current || !input.length) return;
      const snapshot = snapshotDownloadCards(input),
        job = new AbortController();
      controller.current = job;
      setBusy(true);
      setReady(null);
      resultRef.current = null;
      setStatus("Preparing download…");
      try {
        const { buildFactExport, downloadBlob } = await import("@/lib/exports");
        job.signal.throwIfAborted();
        const result = await buildFactExport(mode, workspaceName, snapshot, {
          individual,
          signal: job.signal,
          onProgress: (message) => {
            if (controller.current === job) setStatus(message);
          },
        });
        job.signal.throwIfAborted();
        if (controller.current !== job) return;
        resultRef.current = result;
        setReady(result);
        downloadBlob(result.blob, result.filename);
        setStatus(
          `File ready. ${result.omittedImages.length ? `${result.omittedImages.length} picture(s) unavailable; all text and sources retained.` : "All cards and sources included."}`,
        );
      } catch (error) {
        if (controller.current === job)
          setStatus(
            job.signal.aborted
              ? "Download canceled."
              : error instanceof Error
                ? error.message
                : "Download could not be prepared.",
          );
      } finally {
        if (controller.current === job) {
          controller.current = null;
          setBusy(false);
        }
      }
    },
    [mode, workspaceName],
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
  return (
    <div className="download-feedback" aria-live="polite">
      {d.status && <span role="status">{d.status}</span>}
      {d.busy && (
        <button type="button" className="ghost-button" onClick={d.cancel}>
          Cancel download
        </button>
      )}
      {d.ready && !d.busy && (
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
