"use client";

import type { GeminiModelCheck, GeminiStatus } from "@/lib/types";
import type { YouTubeImportProgress } from "@/lib/youtube";
import { Icon } from "./icons";

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
  youtubeKey: string;
  youtubeStatus: "not-configured" | "connecting" | "connected" | "error";
  youtubeProgress: YouTubeImportProgress;
  onYoutubeKeyChange: (value: string) => void;
  onConnectYoutube: () => void;
  onRemoveYoutubeKey: () => void;
  onPauseYoutubeImport: () => void;
  onResumeYoutubeImport: () => void;
  onRetryYoutubeImport: () => void;
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

export function SettingsView({ apiKey, onApiKeyChange, status, feedback, modelChecks, modelChecking, onTestConnection, onRemoveKey, theme, onThemeChange, onResetAll, onDeleteLearningData, onGoogleSignIn, youtubeKey, youtubeStatus, youtubeProgress, onYoutubeKeyChange, onConnectYoutube, onRemoveYoutubeKey, onPauseYoutubeImport, onResumeYoutubeImport, onRetryYoutubeImport }: SettingsViewProps) {
  const workingModelCount = new Set(modelChecks.filter((model) => model.status === "working").map((model) => model.resolvedModel ?? model.model)).size;
  return (
    <section className="content-view settings-view">
      <div className="view-heading">
        <div>
          <span className="eyebrow">Your workspace</span>
          <h1>Make the feed feel like yours.</h1>
          <p>Settings stay calm, clear, and close to the experience they shape.</p>
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
                <p>Use Gemini for fresh facts, Learn more, and questions.</p>
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
              <span>Your pasted key is held in memory for this session, sent only when Gemini is requested, and never saved to localStorage.</span>
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
                <p>Create or copy one in Google AI Studio, then paste it here.</p>
              </div>
              <a className="api-key-link" href={AI_STUDIO_KEY_URL} target="_blank" rel="noreferrer">
                Open AI Studio <Icon name="external" size={14} />
              </a>
            </div>
          </section>

          <section className="settings-card youtube-settings-card">
            <div className="settings-card-heading">
              <div className="settings-icon blue"><Icon name="image" size={19} /></div>
              <div><h2>YouTube Videos</h2><p>Use your own YouTube Data API key for the approved video library.</p></div>
              <span className={`status-dot ${youtubeStatus === "connected" ? "connected" : youtubeStatus === "error" ? "unavailable" : ""}`}>{youtubeStatus === "connecting" ? "Connecting" : youtubeStatus === "connected" ? "Connected" : youtubeStatus === "error" ? "Needs attention" : "Not configured"}</span>
            </div>
            <label className="field-label" htmlFor="youtube-key">Paste your YouTube API key here</label>
            <div className="key-input-row"><input id="youtube-key" type="password" value={youtubeKey} onChange={(event) => onYoutubeKeyChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onConnectYoutube(); } }} placeholder="Paste your YouTube API key here" autoComplete="new-password" /><div className="key-actions"><button type="button" className="primary-button small" onClick={onConnectYoutube} disabled={youtubeStatus === "connecting"}>{youtubeStatus === "connecting" ? "Connecting" : "Connect YouTube"}</button><button type="button" className="ghost-button" onClick={onRemoveYoutubeKey}>Remove key</button></div></div>
            <div className="security-note"><Icon name="shield" size={16} /><span>Your YouTube key stays in session memory and is never saved to local learning data.</span></div>
            <div className="api-key-guide youtube-guide"><div className="api-key-guide-icon"><Icon name="image" size={16} /></div><div className="api-key-guide-copy"><strong>Need a YouTube key?</strong><p>1. <a href={YOUTUBE_PROJECT_URL} target="_blank" rel="noreferrer">Create or select a Google Cloud project</a><br />2. <a href={YOUTUBE_LIBRARY_URL} target="_blank" rel="noreferrer">Enable YouTube Data API v3</a><br />3. Open <a href={YOUTUBE_CREDENTIALS_URL} target="_blank" rel="noreferrer">Credentials</a> → Create credentials → API key, then restrict it to YouTube Data API v3<br />4. Copy the key here and connect it</p></div></div>
            <p className="youtube-restriction-note">Website keys may be restricted to this GitHub Pages site. The Mac app needs a key that also permits native requests. If a restriction blocks a request, Google will report it here.</p>
            {youtubeProgress.phase !== "idle" && <div className="video-import-notice" role="status"><div><strong>{youtubeProgress.phase === "paused" ? "Import paused" : "Library import"}</strong><span>{youtubeProgress.completedChannels}/{youtubeProgress.totalChannels} channels · {youtubeProgress.importedVideos.toLocaleString()} videos</span></div>{youtubeProgress.phase === "paused" ? <button type="button" className="ghost-button" onClick={onResumeYoutubeImport}>Resume</button> : youtubeProgress.phase === "complete" || youtubeProgress.phase === "error" ? <button type="button" className="ghost-button" onClick={onRetryYoutubeImport}>Retry</button> : <button type="button" className="ghost-button" onClick={onPauseYoutubeImport}>Pause</button>}</div>}
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><div className="settings-icon lilac"><Icon name="user" size={19} /></div><div><h2>Account</h2><p>Google sign-in keeps your mix available across sessions.</p></div></div>
            <div className="account-row"><div className="account-avatar">L</div><div><strong>Local workspace</strong><span>Not signed in</span></div><button type="button" className="secondary-button" onClick={onGoogleSignIn}><Icon name="login" size={15} /> Continue with Google</button></div>
          </section>

          <section className="settings-card">
            <div className="settings-card-heading"><div className="settings-icon mint"><Icon name="sun" size={19} /></div><div><h2>Appearance</h2><p>Choose the atmosphere you want to return to.</p></div></div>
            <div className="theme-switcher"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><Icon name="sun" size={16} /> Light</button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><Icon name="moon" size={16} /> Dark</button></div>
          </section>
        </div>

        <aside className="settings-side">
          <section className="danger-card"><span className="eyebrow">Advanced</span><h2>Clear the slate.</h2><p>Feed reset is gentle. These controls affect the rest of your saved workspace.</p><button type="button" className="ghost-button full" onClick={onResetAll}><Icon name="reset" size={15} /> Reset all preferences</button><button type="button" className="danger-button full" onClick={onDeleteLearningData}><Icon name="trash" size={15} /> Delete learning data</button></section>
          <section className="settings-help"><Icon name="help" size={17} /><div><strong>Privacy by default</strong><p>Your Google profile and Gemini credential never belong in a prompt. The server only sends topic and preference signals.</p></div></section>
        </aside>
      </div>
    </section>
  );
}
