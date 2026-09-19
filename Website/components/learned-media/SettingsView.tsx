"use client";

import type { GeminiModelCheck, GeminiStatus } from "@/lib/types";
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
};

const AI_STUDIO_KEY_URL = "https://aistudio.google.com/app/apikey";

const statusCopy: Record<GeminiStatus, string> = {
  "not-configured": "Not configured",
  testing: "Testing…",
  connected: "Connected",
  invalid: "Invalid key",
  "rate-limited": "Rate limited",
  unavailable: "Gemini unavailable"
};

export function SettingsView({ apiKey, onApiKeyChange, status, feedback, modelChecks, modelChecking, onTestConnection, onRemoveKey, theme, onThemeChange, onResetAll, onDeleteLearningData, onGoogleSignIn }: SettingsViewProps) {
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
                <button type="button" className="primary-button small" onClick={onTestConnection} disabled={status === "testing"}><Icon name="sparkles" size={15} /> {status === "testing" ? "Connecting…" : "Connect Gemini"}</button>
                <button type="button" className="ghost-button" onClick={onRemoveKey}>Remove</button>
              </div>
            </div>
            <div className="security-note" id="gemini-key-note">
              <Icon name="shield" size={16} />
              <span>Your pasted key is held in memory for this session, sent only when Gemini is requested, and never saved to localStorage.</span>
            </div>
            {feedback && <p className="settings-feedback" role="status">{feedback}</p>}

            <div className="model-check-heading">
              <div><strong>Available Gemini models</strong><span>{modelChecks.length ? `${modelChecks.filter((model) => model.status === "working").length} working of ${modelChecks.length}` : "Connect to discover models"}</span></div>
              <button type="button" className="ghost-button" onClick={onTestConnection} disabled={modelChecking || !apiKey.trim()}>{modelChecking ? "Checking…" : "Check all models"}</button>
            </div>
            {modelChecks.length > 0 && <div className="model-check-list" aria-live="polite">{modelChecks.map((model) => <div className="model-check-row" key={model.model}><span className={`model-status-dot ${model.status}`} aria-label={model.status} /><div><strong>{model.model}</strong><small>{model.status === "working" ? "Ready for generation" : model.error ?? "Unavailable"}</small></div><span className="model-check-meta">{model.latencyMs ? `${model.latencyMs} ms` : "—"}<br />{model.checkedAt ? new Date(model.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not checked"}</span></div>)}</div>}

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
