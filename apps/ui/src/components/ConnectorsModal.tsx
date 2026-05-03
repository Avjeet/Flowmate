import { useState, useEffect } from "react";
import { getConfig, saveConfig, BASE } from "../api";

type ConnectorId = "gitlab" | "github" | "jira";
type TestState = "idle" | "testing" | "ok" | "error";

interface TestResult {
  ok: boolean;
  label?: string;
  error?: string;
}

interface Props {
  onClose: () => void;
}

export function ConnectorsModal({ onClose }: Props) {
  const [tab, setTab] = useState<ConnectorId>("gitlab");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // GitLab
  const [glHost, setGlHost] = useState("gitlab.com");
  const [glToken, setGlToken] = useState("");
  const [glTest, setGlTest] = useState<TestState>("idle");
  const [glResult, setGlResult] = useState<TestResult | null>(null);

  // GitHub
  const [ghToken, setGhToken] = useState("");
  const [ghTest, setGhTest] = useState<TestState>("idle");
  const [ghResult, setGhResult] = useState<TestResult | null>(null);

  // Jira
  const [jHost, setJHost] = useState("");
  const [jEmail, setJEmail] = useState("");
  const [jToken, setJToken] = useState("");
  const [jTest, setJTest] = useState<TestState>("idle");
  const [jResult, setJResult] = useState<TestResult | null>(null);

  // Load existing config on mount
  useEffect(() => {
    getConfig().then((config) => {
      if (config?.integrations?.gitlab) {
        setGlHost(config.integrations.gitlab.host || "gitlab.com");
        setGlToken(config.integrations.gitlab.token || "");
      }
      if (config?.integrations?.github) {
        setGhToken(config.integrations.github.token || "");
      }
      if (config?.integrations?.jira) {
        setJHost(config.integrations.jira.host || "");
        setJEmail(config.integrations.jira.email || "");
        setJToken(config.integrations.jira.token || "");
      }
    });
  }, []);

  async function testGitLab() {
    setGlTest("testing");
    setGlResult(null);
    try {
      const r = await fetch(`${BASE}/test/gitlab`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: glHost, token: glToken }),
      });
      const data = await r.json();
      setGlResult(data.ok ? { ok: true, label: `@${data.username}` } : { ok: false, error: data.error });
      setGlTest(data.ok ? "ok" : "error");
    } catch {
      setGlResult({ ok: false, error: "Could not reach server" });
      setGlTest("error");
    }
  }

  async function testGitHub() {
    setGhTest("testing");
    setGhResult(null);
    try {
      const r = await fetch(`${BASE}/test/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: ghToken }),
      });
      const data = await r.json();
      setGhResult(data.ok ? { ok: true, label: `@${data.login}` } : { ok: false, error: data.error });
      setGhTest(data.ok ? "ok" : "error");
    } catch {
      setGhResult({ ok: false, error: "Could not reach server" });
      setGhTest("error");
    }
  }

  async function testJira() {
    setJTest("testing");
    setJResult(null);
    try {
      const r = await fetch(`${BASE}/test/jira`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: jHost, email: jEmail, token: jToken }),
      });
      const data = await r.json();
      setJResult(data.ok ? { ok: true, label: data.displayName } : { ok: false, error: data.error });
      setJTest(data.ok ? "ok" : "error");
    } catch {
      setJResult({ ok: false, error: "Could not reach server" });
      setJTest("error");
    }
  }

  async function handleSave() {
    setSaving(true);
    const integrations: Record<string, unknown> = {};
    if (glToken.trim()) integrations.gitlab = { host: glHost.trim(), token: glToken.trim() };
    if (ghToken.trim()) integrations.github = { token: ghToken.trim() };
    if (jHost.trim() && jToken.trim()) integrations.jira = { host: jHost.trim(), email: jEmail.trim(), token: jToken.trim() };
    await saveConfig({ integrations });
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 900);
  }

  const TABS: { id: ConnectorId; label: string; color: string }[] = [
    { id: "gitlab", label: "GitLab", color: "orange" },
    { id: "github", label: "GitHub", color: "gray" },
    { id: "jira",   label: "Jira",   color: "blue" },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-white font-semibold text-sm">Connectors</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-lg leading-none">×</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-5 py-2.5 text-xs font-medium border-b-2 -mb-px transition-colors ${
                tab === t.id ? "text-white border-blue-500" : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="px-5 py-5 space-y-4">
          {tab === "gitlab" && (
            <ConnectorForm
              title="GitLab"
              accent="orange"
              fields={[
                { label: "Host", value: glHost, onChange: setGlHost, placeholder: "gitlab.com" },
                { label: "Personal Access Token", value: glToken, onChange: setGlToken, placeholder: "glpat-…", secret: true },
              ]}
              testState={glTest}
              testResult={glResult}
              onTest={testGitLab}
              hint="Token needs: api, read_user scopes"
            />
          )}

          {tab === "github" && (
            <ConnectorForm
              title="GitHub"
              accent="gray"
              fields={[
                { label: "Personal Access Token", value: ghToken, onChange: setGhToken, placeholder: "ghp_… or github_pat_…", secret: true },
              ]}
              testState={ghTest}
              testResult={ghResult}
              onTest={testGitHub}
              hint="Token needs: repo scope (or fine-grained: pull requests read/write)"
            />
          )}

          {tab === "jira" && (
            <ConnectorForm
              title="Jira"
              accent="blue"
              fields={[
                { label: "Host", value: jHost, onChange: setJHost, placeholder: "yourorg.atlassian.net" },
                { label: "Email", value: jEmail, onChange: setJEmail, placeholder: "you@example.com" },
                { label: "API Token", value: jToken, onChange: setJToken, placeholder: "API token from id.atlassian.com", secret: true },
              ]}
              testState={jTest}
              testResult={jResult}
              onTest={testJira}
              hint="Generate token at id.atlassian.com → Security → API tokens"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
            Cancel
          </button>
          {saved ? (
            <span className="text-xs text-green-400">✓ Saved</span>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs font-semibold transition-colors"
            >
              {saving ? "Saving…" : "Save All"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable connector form ────────────────────────────────────────────────────

interface Field {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
}

interface ConnectorFormProps {
  title: string;
  accent: string;
  fields: Field[];
  testState: TestState;
  testResult: TestResult | null;
  onTest: () => void;
  hint?: string;
}

function ConnectorForm({ fields, testState, testResult, onTest, hint }: ConnectorFormProps) {
  const borderFocus: Record<string, string> = {
    orange: "focus:border-orange-600",
    gray: "focus:border-gray-500",
    blue: "focus:border-blue-600",
  };

  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <div key={f.label} className="space-y-1">
          <label className="text-xs text-gray-400">{f.label}</label>
          <input
            value={f.value}
            onChange={(e) => f.onChange(e.target.value)}
            type={f.secret ? "password" : "text"}
            placeholder={f.placeholder}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 transition-colors"
          />
        </div>
      ))}

      {hint && <p className="text-xs text-gray-600">{hint}</p>}

      {/* Test connection */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onTest}
          disabled={testState === "testing"}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs transition-colors flex items-center gap-1.5"
        >
          {testState === "testing" ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full border border-gray-400 border-t-transparent animate-spin" />
              Testing…
            </>
          ) : "Test Connection"}
        </button>

        {testResult && (
          testResult.ok ? (
            <span className="text-xs text-green-400">✓ Connected{testResult.label ? ` as ${testResult.label}` : ""}</span>
          ) : (
            <span className="text-xs text-red-400">✗ {testResult.error}</span>
          )
        )}
      </div>
    </div>
  );
}
