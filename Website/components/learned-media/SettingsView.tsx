"use client";

import { useState } from "react";
import type { FactCard, GeminiModelCheck, GeminiStatus } from "@/lib/types";
import { buildFactExport, downloadBlob, type FactExportFormat } from "@/lib/exports";
import type { YouTubeImportProgress } from "@/lib/youtube";
import { Icon } from "./icons";

type SyncStatus = "signed-out" | "syncing" | "synced" | "offline" | "error";

type SettingsViewProps = {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  status: GeminiStatus;
  feedback?: string;
  modelChecks: GeminiModelCheck[];
  modelChecking: boolean;
  onTestConnection: () => void;
  onRemoveKey: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onResetAll: () => void;
  onDeleteLearningData: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  account?: { id: string; email?: string; user_metadata?: Record<string, unknown> | null } | null;
  syncStatus: SyncStatus;
  syncError?: string;
  youtubeKey: string;
  youtubeStatus: "not-configured" | "connecting" | "refreshing" | "connected" | "error";
  youtubeProgress: YouTubeImportProgress;
  youtubeLastSyncAt?: string;
  onYoutubeKeyChange: (value: string) => void;
  onConnectYoutube: () => void;
  onRemoveYoutubeKey: () => void;
  onPauseYoutubeImport: () => void;
  onResumeYoutubeImport: () => void;
  onRetryYoutubeImport: () => void;
  onRefreshYoutube: () => void;
  workspaceName: string;
  cards: FactCard[];
};

const AI_STUDIO_KEY_URL = "https://aistudio.google.com/app/apikey";
const YOUTUBE_PROJECT_URL = "https://console.cloud.google.com/projectcreate";
const YOUTUBE_LIBRARY_URL = "https://console.cloud.google.com/apis/library/youtube.googleapis.com";
const YOUTUBE_CREDENTIALS_URL = "https://console.cloud.google.com/apis/credentials";

const statusCopy: Record<GeminiStatus, string> = {
  "not-configured": "Not configured",
  testing: "Testing",
  connected: "Connected",
  invalid: "Invalid key",
  "rate-limited": "Rate limited",
  unavailable: "Gemini unavailable"
};

export function SettingsView({ apiKey, onApiKeyChange, status, feedback, modelChecks, modelChecking, onTestConnection, onRemoveKey, theme, onThemeChange, onResetAll, onDeleteLearningData, onGoogleSignIn, onGoogleSignOut, account, syncStatus, syncError, youtubeKey, youtubeStatus, youtubeProgress, youtubeLastSyncAt, onYoutubeKeyChange, onConnectYoutube, onRemoveYoutubeKey, onPauseYoutubeImport, onResumeYoutubeImport, onRetryYoutubeImport, onRefreshYoutube, workspaceName, cards }: SettingsViewProps) {
  const workingModelCount = new Set(modelChecks.filter((model) => model.status === "working").map((model) => model.resolvedModel ?? model.model)).size;
  const [exportCollection, setExportCollection] = useState<"all" | "saved">("all");
  const [exporting, setExporting] = useState<FactExportFormat | null>(null);
  const exportCards = exportCollection === "saved" ? cards.filter((card) => card.saved) : cards;
  async function exportFacts(format: FactExportFormat) {
    if (!exportCards.length || exporting) return;
    setExporting(format);
    try {
      const result = await buildFactExport(format, workspaceName, exportCards);
      downloadBlob(result.blob, result.filename);
      if (result.omittedImages.length) window.alert(`The export is complete. Images could not be loaded for ${result.omittedImages.length} fact${result.omittedImages.length === 1 ? "" : "s"}; all text and sources were kept.`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "The facts could not be exported.");
    } finally { setExporting(null); }
  }
  return (
    <section className="content-view settings-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h1>Make the feed feel like yours</h1>
          <p>Settings stay calm, clear, and close to the experience they shape</p>
        </div>
        <div className="settings-avatar">S</div>
      </div>

      <div className="settings-grid">
        <div className="settings-main">
          <section className="settings-card gemini-settings-card">
            <div className="settings-card-heading">
              <div className="settings-icon blue"><Icon name="key" size={19} /></div>
              <div>
                <h2>Gemini API key</h2>
                <p>Use Gemini for fresh facts, Learn more, and questions</p>
              </div>
              <span className={`status-dot ${status}`}>{statusCopy[status]}</span>
            </div>

            <label className="field-label" htmlFor="gemini-key">Paste your API key here</label>
            <div className="key-input-row">
              <input id="gemini-key" type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onTestConnection(); } }} placeholder="Paste your API key here" autoComplete="new-password" aria-describedby="gemini-key-note" />
              <div className="key-actions">
                <button type="button" className="primary-button small" onClick={onTestConnection} disabled={status === "testing"}><Icon name="sparkles" size={15} /> {status === "testing" ? "Connecting" : "Connect Gemini"}</button>
                <button type="button" className="ghost-button" onClick={onRemoveKey}>Remove</button>
              </div>
            </div>
            <div className="security-note" id="gemini-key-note">
              <Icon name="shield" size={16} />
              <span>Your key is remembered on this device in encrypted browser storage, separate from workspaces. It is never synced to your account. Use Remove on a shared device</span>
            </div>
            {feedback && <p className="settings-feedback" role="status">{feedback}</p>}

            <div className="model-check-heading">
              <div><strong>Available Gemini models</strong><span>{modelChecks.length ? `${workingModelCount} ready of ${modelChecks.length} checks` : "Connect to discover models"}</span></div>
              <button type="button" className="ghost-button" onClick={onTestConnection} disabled={modelChecking || !apiKey.trim()}>{modelChecking ? "Checking" : "Check all models"}</button>
            </div>
            {modelChecks.length > 0 && <div className="model-check-list" aria-live="polite">{modelChecks.map((model) => <div className="model-check-row" key={model.model}><span className={`model-status-dot ${model.status}`} aria-label={model.status} /><div><strong>{model.model}</strong><small>{model.status === "working" ? (model.resolvedModel && model.resolvedModel !== model.model ? `Ready · resolves to ${model.resolvedModel}` : "Ready for generation") : model.error ?? "Unavailable"}</small></div><span className="model-check-meta">{model.latencyMs ? `${model.latencyMs} ms` : "—"}<br />{model.checkedAt ? new Date(model.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked"}</span></div>)}</div>}

            <div className="api-key-guide">
              <div className="api-key-guide-icon"><Icon name="sparkles" size={16} /></div>
              <div className="api-key-guide-copy">
                <strong>Need a key?</strong>
                <p>Create or copy one in Google AI Studio, then paste it here</p>
              </div>
              <a className="api-key-link" href={AI_STUDIO_KEY_URL} target="_blank" rel="noreferrer">
                Open AI Studio <Icon name="external" size={14} />
              </a>
            </div>
          </section>

          <section className="settings-card youtube-settings-card">
            <div className="settings-card-heading">
              <div className="settings-icon blue"><Icon name="image" size={19} /></div>
              <div><h2>YouTube Videos</h2><p>Use your own YouTube Data API key for the approved video library</p></div>
              <span className={`status-dot ${youtubeStatus === "connected" || youtubeStatus === "refreshing" ? "connected" : youtubeStatus === "error" ? "unavailable" : ""}`}>{youtubeStatus === "connecting" ? "Connecting" : youtubeStatus === "refreshing" ? "Refreshing" : youtubeStatus === "connected" ? "Connected" : youtubeStatus === "error" ? "Needs attention" : "Not configured"}</span>
            </div>
            <label className="field-label" htmlFor="youtube-key">Paste your YouTube API key here</label>
            <div className="key-input-row"><input id="youtube-key" type="password" value={youtubeKey} onChange={(event) => onYoutubeKeyChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onConnectYoutube(); } }} placeholder="Paste your YouTube API key here" autoComplete="new-password" /><div className="key-actions"><button type="button" className="primary-button small" onClick={onConnectYoutube} disabled={youtubeStatus === "connecting" || youtubeStatus === "refreshing"}>{youtubeStatus === "connecting" ? "Connecting" : youtubeStatus === "refreshing" ? "Refreshing" : "Connect YouTube"}</button><button type="button" className="ghost-button" onClick={onRefreshYoutube} disabled={youtubeStatus === "connecting" || youtubeStatus === "refreshing"}>Refresh videos</button><button type="button" className="ghost-button" onClick={onRemoveYoutubeKey}>Remove key</button></div></div>
            <div className="security-note"><Icon name="shield" size={16} /><span>Your YouTube key is remembered on this device in encrypted browser storage, separate from workspaces and account sync</span></div>
            <div className="api-key-guide youtube-guide"><div className="api-key-guide-icon"><Icon name="image" size={16} /></div><div className="api-key-guide-copy"><strong>Need a YouTube key?</strong><p>1. <a href={YOUTUBE_PROJECT_URL} target="_blank" rel="noreferrer">Create or select a Google Cloud project</a><br />2. <a href={YOUTUBE_LIBRARY_URL} target="_blank" rel="noreferrer">Enable YouTube Data API v3</a><br />3. Open <a href={YOUTUBE_CREDENTIALS_URL} target="_blank" rel="noreferrer">Credentials</a> → Create credentials → API key, then restrict it to YouTube Data API v3<br />4. Copy the key here and connect it</p></div></div>
            <p className="youtube-restriction-note">Website keys may be restricted to this GitHub Pages site. The Mac app needs a key that also permits native requests. If a restriction blocks a request, Google will report it here</p>
            {youtubeLastSyncAt && <p className="youtube-restriction-note">Last successful refresh: {new Date(youtubeLastSyncAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</p>}
            {youtubeProgress.phase !== "idle" && <div className="video-import-notice" role="status"><div><strong>{youtubeProgress.phase === "paused" ? "Import paused" : youtubeStatus === "refreshing" ? "Refreshing library" : "Library import"}</strong><span>{youtubeProgress.completedSources !== undefined ? `${youtubeProgress.completedSources}/${youtubeProgress.totalSources ?? 0} sources · ` : `${youtubeProgress.completedChannels}/${youtubeProgress.totalChannels} channels · `}{youtubeProgress.importedVideos.toLocaleString()} videos</span></div>{youtubeProgress.phase === "paused" ? <button type="button" className="ghost-button" onClick={onResumeYoutubeImport}>Resume</button> : youtubeProgress.phase === "complete" || youtubeProgress.phase === "error" ? <button type="button" className="ghost-button" onClick={onRetryYoutubeImport}>Retry</button> : <button type="button" className="ghost-button" onClick={onPauseYoutubeImport}>Pause</button>}</div>}
          </section>

          <section className="settings-card export-settings-card">
            <div className="settings-card-heading"><div className="settings-icon lilac"><Icon name="bookmark" size={19} /></div><div><h2>Download Facts</h2><p>Save this workspace with its topic paths and Wikipedia sources</p></div></div>
            <div className="export-controls"><label className="field-label" htmlFor="export-collection">Collection</label><select id="export-collection" value={exportCollection} onChange={(event) => setExportCollection(event.target.value as "all" | "saved")}><option value="all">All Facts ({cards.length})</option><option value="saved">Saved Facts ({cards.filter((card) => card.saved).length})</option></select><div className="export-buttons"><button type="button" className="secondary-button" disabled={!exportCards.length || Boolean(exporting)} onClick={() => void exportFacts("pdf")}>{exporting === "pdf" ? "Preparing PDF…" : "PDF"}</button><button type="button" className="secondary-button" disabled={!exportCards.length || Boolean(exporting)} onClick={() => void exportFacts("txt")}>{exporting === "txt" ? "Preparing TXT…" : "TXT"}</button><button type="button" className="secondary-button" disabled={!exportCards.length || Boolean(exporting)} onClick={() => void exportFacts("docx")}>{exporting === "docx" ? "Preparing DOCX…" : "DOCX"}</button></div></div>
            {!cards.length && <p className="youtube-restriction-note">Generate or save a fact before downloading it</p>}
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><div className="settings-icon lilac"><Icon name="user" size={19} /></div><div><h2>Account</h2><p>Google sign-in keeps your mix available across sessions</p></div></div>
            <div className="account-row"><div className="account-avatar">{account ? (String(account.user_metadata?.full_name ?? account.user_metadata?.name ?? account.email ?? "G").slice(0, 1).toUpperCase()) : "L"}</div><div><strong>{account ? String(account.user_metadata?.full_name ?? account.user_metadata?.name ?? account.email ?? "Google account") : "Local workspace"}</strong><span>{account ? (syncStatus === "syncing" ? "Syncing your workspace…" : syncStatus === "offline" ? "Offline; local changes are safe" : syncStatus === "error" ? "Sync needs attention" : "Synced to your Google account") : "Not signed in · saved locally"}</span></div><button type="button" className="secondary-button" onClick={account ? onGoogleSignOut : onGoogleSignIn}><Icon name="login" size={15} /> {account ? "Sign out" : "Continue with Google"}</button></div>
            {syncError && <p className="settings-feedback" role="alert">{syncError}</p>}
            <p className="youtube-restriction-note">Workspace cards, saved state, learning history, questions, explanations, topic settings, and fact memory sync when you sign in. Gemini keys, YouTube keys, OAuth credentials, and the YouTube catalog stay on this device</p>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><div className="settings-icon mint"><Icon name="sun" size={19} /></div><div><h2>Appearance</h2><p>Choose the atmosphere you want to return to</p></div></div>
            <div className="theme-switcher"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><Icon name="sun" size={16} /> Light</button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><Icon name="moon" size={16} /> Dark</button></div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="danger-card"><span className="eyebrow">Advanced</span><h2>Clear the slate</h2><p>Feed reset is gentle. These controls affect the rest of your saved workspace</p><button type="button" className="ghost-button full" onClick={onResetAll}><Icon name="reset" size={15} /> Reset all preferences</button><button type="button" className="danger-button full" onClick={onDeleteLearningData}><Icon name="trash" size={15} /> Delete learning data</button></section>
          <section className="settings-help mobile-use-help"><Icon name="smartphone" size={17} /><div><strong>Use Learned Media on mobile</strong><p>Open the site in Safari or Chrome on your iPhone. In Safari, tap Share → Add to Home Screen to keep it beside your other apps. The layout adapts to narrow screens without horizontal scrolling</p></div></section>
          <section className="settings-help"><Icon name="help" size={17} /><div><strong>Privacy by default</strong><p>Your Google profile and Gemini credential never belong in a prompt. The server only sends topic and preference signals</p></div></section>
        </aside>
      </div>
    </section>
  );
}
