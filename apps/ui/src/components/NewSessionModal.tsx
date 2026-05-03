import { useState } from "react";
import { createSession } from "../api";

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

export function NewSessionModal({ onCreated, onClose }: Props) {
  const [name, setName] = useState("");
  const [jira, setJira] = useState("");
  const [gitlabRepo, setGitlabRepo] = useState("");
  const [gitlabMR, setGitlabMR] = useState("");
  const [agent, setAgent] = useState<"claude" | "opencode">("claude");
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    await createSession({
      name: name.trim(),
      agentType: agent,
      jiraTicket: jira.trim() || undefined,
      gitlabRepo: gitlabRepo.trim() || undefined,
      gitlabMR: gitlabMR.trim() || undefined,
    });
    setLoading(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-white font-semibold text-base">New FlowMate Session</h2>

        <div className="space-y-3">
          <Field label="Session name *">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Add user auth flow"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </Field>

          <Field label="Agent">
            <div className="flex gap-2">
              {(["claude", "opencode"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setAgent(a)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    agent === a
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                  }`}
                >
                  {a === "claude" ? "Claude Code" : "OpenCode"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="JIRA ticket (optional)">
            <input
              value={jira}
              onChange={(e) => setJira(e.target.value)}
              placeholder="e.g. PROJ-123"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </Field>

          <Field label="GitLab repo (optional)">
            <input
              value={gitlabRepo}
              onChange={(e) => setGitlabRepo(e.target.value)}
              placeholder="e.g. myorg/myrepo"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </Field>

          <Field label="GitLab MR number (optional)">
            <input
              value={gitlabMR}
              onChange={(e) => setGitlabMR(e.target.value)}
              placeholder="e.g. 42"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
            />
          </Field>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleCreate}
            disabled={!name.trim() || loading}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded text-sm font-semibold transition-colors"
          >
            {loading ? "Creating..." : "Start Session"}
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
