import { useState } from "react";
import { saveConfig } from "../api";

interface Props {
  onDismiss: () => void;
}

export function IntegrationBanner({ onDismiss }: Props) {
  const [showSetup, setShowSetup] = useState(false);
  const [gitlabHost, setGitlabHost] = useState("gitlab.com");
  const [gitlabToken, setGitlabToken] = useState("");
  const [jiraHost, setJiraHost] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraToken, setJiraToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    const integrations: Record<string, unknown> = {};
    if (gitlabToken.trim()) integrations.gitlab = { host: gitlabHost.trim(), token: gitlabToken.trim() };
    if (jiraHost.trim() && jiraToken.trim()) integrations.jira = { host: jiraHost.trim(), email: jiraEmail.trim(), token: jiraToken.trim() };
    await saveConfig({ port: 7842, integrations });
    setSaving(false);
    setSaved(true);
    setTimeout(onDismiss, 800);
  }

  if (saved) {
    return (
      <div className="mx-4 mt-2 px-4 py-2 bg-green-950/40 border border-green-700 rounded-lg text-xs text-green-300">
        ✓ Integrations saved.
      </div>
    );
  }

  if (!showSetup) {
    return (
      <div className="mx-4 mt-2 px-4 py-2.5 bg-gray-800/60 border border-gray-700 rounded-lg flex items-center justify-between gap-4">
        <div>
          <span className="text-xs text-gray-300">No integrations configured. </span>
          <span className="text-xs text-gray-500">GitLab and JIRA panels are hidden until connected.</span>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowSetup(true)}
            className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-xs font-semibold transition-colors"
          >
            Connect
          </button>
          <button onClick={onDismiss} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">
            Skip
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2 p-4 bg-gray-800/60 border border-gray-700 rounded-lg space-y-4">
      <p className="text-xs font-semibold text-gray-300">Connect Integrations</p>

      <div className="grid grid-cols-2 gap-4">
        {/* GitLab */}
        <div className="space-y-2">
          <p className="text-xs text-orange-400 font-medium">GitLab</p>
          <input value={gitlabHost} onChange={(e) => setGitlabHost(e.target.value)}
            placeholder="Host (e.g. gitlab.com)"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-600" />
          <input value={gitlabToken} onChange={(e) => setGitlabToken(e.target.value)}
            placeholder="Personal access token"
            type="password"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-orange-600" />
        </div>

        {/* JIRA */}
        <div className="space-y-2">
          <p className="text-xs text-blue-400 font-medium">JIRA</p>
          <input value={jiraHost} onChange={(e) => setJiraHost(e.target.value)}
            placeholder="Host (e.g. org.atlassian.net)"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600" />
          <input value={jiraEmail} onChange={(e) => setJiraEmail(e.target.value)}
            placeholder="Email"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600" />
          <input value={jiraToken} onChange={(e) => setJiraToken(e.target.value)}
            placeholder="API token"
            type="password"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600" />
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onDismiss} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors">Skip</button>
        <button onClick={handleSave} disabled={saving}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-xs font-semibold transition-colors">
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
