import { useState } from "react";
import { createSession, BASE } from "../api";

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

interface GitInfo {
  repo: string;
  branch: string;
  provider: "github" | "gitlab" | "unknown";
}

export function NewSessionModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [cwd, setCwd] = useState("");
  const [jira, setJira] = useState("");
  const [gitlabRepo, setGitlabRepo] = useState("");
  const [gitlabMR, setGitlabMR] = useState("");
  const [agent, setAgent] = useState<"claude" | "opencode">("claude");
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<GitInfo | null>(null);
  const [detectError, setDetectError] = useState<string | null>(null);

  async function detectGit() {
    if (!cwd.trim()) return;
    setDetecting(true);
    setDetected(null);
    setDetectError(null);
    try {
      const r = await fetch(`${BASE}/detect-git?path=${encodeURIComponent(cwd.trim())}`);
      if (!r.ok) {
        const e = await r.json();
        setDetectError(e.error ?? "Not a git repo");
        return;
      }
      const data = await r.json();
      if (data.provider === "unknown" || !data.repo) {
        setDetectError("Remote found but not GitHub or GitLab");
        return;
      }
      setDetected(data);
      // Auto-fill GitLab repo if gitlab detected
      if (data.provider === "gitlab") setGitlabRepo(data.repo);
    } catch {
      setDetectError("Could not reach server");
    } finally {
      setDetecting(false);
    }
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    await createSession({
      name: name.trim(),
      agentType: agent,
      cwd: cwd.trim() || undefined,
      jiraTicket: jira.trim() || undefined,
      gitlabRepo: (detected?.provider === "gitlab" ? detected.repo : gitlabRepo.trim()) || undefined,
      gitlabMR: gitlabMR.trim() || undefined,
    });
    setLoading(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-white font-semibold text-base">New Session</h2>

        <div className="space-y-3">
          <Field label="Session name *">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Add user auth flow"
              className="input"
            />
          </Field>

          <Field label="Agent">
            <div className="flex gap-2">
              {(["claude", "opencode"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAgent(a)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    agent === a ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {a === "claude" ? "Claude Code" : "OpenCode"}
                </button>
              ))}
            </div>
          </Field>

          {/* Project directory + git detect */}
          <Field label="Project directory">
            <div className="flex gap-2">
              <input
                value={cwd}
                onChange={(e) => { setCwd(e.target.value); setDetected(null); setDetectError(null); }}
                onBlur={detectGit}
                placeholder="/path/to/your/project"
                className="input flex-1"
              />
              <button
                onClick={detectGit}
                disabled={!cwd.trim() || detecting}
                className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs transition-colors shrink-0"
              >
                {detecting ? "…" : "Detect"}
              </button>
            </div>

            {detected && (
              <div className={`mt-1.5 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs ${
                detected.provider === "github"
                  ? "bg-gray-800/60 border-gray-600"
                  : "bg-orange-950/30 border-orange-800"
              }`}>
                <span className="text-green-400">✓</span>
                <span className={detected.provider === "github" ? "text-gray-300" : "text-orange-300"}>
                  {detected.provider === "github" ? "GitHub" : "GitLab"}
                </span>
                <code className="text-white">{detected.repo}</code>
                {detected.branch && (
                  <span className="text-gray-500">on <code className="text-gray-300">{detected.branch}</code></span>
                )}
              </div>
            )}
            {detectError && (
              <p className="mt-1 text-xs text-red-400">{detectError}</p>
            )}
          </Field>

          <Field label="JIRA ticket (optional)">
            <input
              value={jira}
              onChange={(e) => setJira(e.target.value)}
              placeholder="e.g. PROJ-123"
              className="input"
            />
          </Field>

          {/* Only show GitLab fields if not auto-detected as gitlab */}
          {detected?.provider !== "gitlab" && (
            <Field label="GitLab repo (optional)">
              <input
                value={gitlabRepo}
                onChange={(e) => setGitlabRepo(e.target.value)}
                placeholder="e.g. myorg/myrepo"
                className="input"
              />
            </Field>
          )}

          {gitlabRepo.trim() && (
            <Field label="GitLab MR number (optional)">
              <input
                value={gitlabMR}
                onChange={(e) => setGitlabMR(e.target.value)}
                placeholder="e.g. 42"
                className="input"
              />
            </Field>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
          >
            {loading ? "Creating…" : "Start Session"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      {children}
    </div>
  );
}
