"use client";

import type { GeminiStatus } from "@/lib/types";
import { Icon } from "./icons";

type SettingsViewProps = {
  apiKey: string;
  onApiKeyChange: (value: string) => void;
  status: GeminiStatus;
  serverConfigured: boolean;
  onTestConnection: () => void;
  onSaveKey: () => void;
  onRemoveKey: () => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  onResetAll: () => void;
  onDeleteLearningData: () => void;
  onGoogleSignIn: () => void;
};

const statusCopy: Record<GeminiStatus, string> = {
  "not-configured": "Not configured",
  testing: "Testing…",
  connected: "Connected",
  invalid: "Invalid key",
  "rate-limited": "Rate limited",
  unavailable: "Gemini unavailable"
};

export function SettingsView({ apiKey, onApiKeyChange, status, serverConfigured, onTestConnection, onSaveKey, onRemoveKey, theme, onThemeChange, onResetAll, onDeleteLearningData, onGoogleSignIn }: SettingsViewProps) {
  return (
    <section className="content-view settings-view">
      <div className="view-heading"><div><span className="eyebrow">Your workspace</span><h1>Make the feed feel like yours.</h1><p>Settings stay calm, clear, and close to the experience they shape.</p></div><div className="settings-avatar">S</div></div>
      <div className="settings-grid">
        <div className="settings-main">
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon blue"><Icon name="key" size={19} /></div><div><h2>Gemini API</h2><p>Bring your own key so generation runs through your account.</p></div><span className={`status-dot ${status}`}>{statusCopy[status]}</span></div><label className="field-label" htmlFor="gemini-key">Gemini API key</label><div className="key-input-row"><input id="gemini-key" type="password" value={apiKey} onChange={(event) => onApiKeyChange(event.target.value)} placeholder="AIza…" autoComplete="off" /><button type="button" className="secondary-button" onClick={onTestConnection} disabled={status === "testing"}><Icon name="flask" size={15} /> Test Connection</button></div><div className="settings-actions"><button type="button" className="primary-button small" onClick={onSaveKey}>Save key</button><button type="button" className="ghost-button" onClick={onRemoveKey}>Remove</button></div><div className="security-note"><Icon name="shield" size={16} /><span>{serverConfigured ? "A server-side GEMINI_API_KEY is configured for this workspace." : "For local setup, put GEMINI_API_KEY in .env.local. Raw keys are never placed in localStorage."}</span></div></section>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon lilac"><Icon name="user" size={19} /></div><div><h2>Account</h2><p>Google sign-in keeps your mix available across sessions.</p></div></div><div className="account-row"><div className="account-avatar">S</div><div><strong>Sample learner</strong><span>Demo workspace · not signed in</span></div><button type="button" className="secondary-button" onClick={onGoogleSignIn}><Icon name="login" size={15} /> Continue with Google</button></div></section>
          <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon mint"><Icon name="sun" size={19} /></div><div><h2>Appearance</h2><p>Choose the atmosphere you want to return to.</p></div></div><div className="theme-switcher"><button type="button" className={theme === "light" ? "selected" : ""} onClick={() => onThemeChange("light")}><Icon name="sun" size={16} /> Light</button><button type="button" className={theme === "dark" ? "selected" : ""} onClick={() => onThemeChange("dark")}><Icon name="moon" size={16} /> Dark</button></div></section>
        </div>
        <aside className="settings-side"><section className="danger-card"><span className="eyebrow">Advanced</span><h2>Clear the slate.</h2><p>Feed reset is gentle. These controls affect the rest of your saved workspace.</p><button type="button" className="ghost-button full" onClick={onResetAll}><Icon name="reset" size={15} /> Reset all preferences</button><button type="button" className="danger-button full" onClick={onDeleteLearningData}><Icon name="trash" size={15} /> Delete learning data</button></section><section className="settings-help"><Icon name="help" size={17} /><div><strong>Privacy by default</strong><p>Your Google profile and Gemini credential never belong in a prompt. The server only sends topic and preference signals.</p></div></section></aside>
      </div>
    </section>
  );
}
