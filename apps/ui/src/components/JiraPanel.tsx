import { useState } from "react";
import type { Session } from "@flowmate/shared";

const BASE = "http://localhost:7842/api";

interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee?: string;
  priority?: string;
  url: string;
}

interface JiraTransition {
  id: string;
  name: string;
  toStatus: string;
}

const STATUS_COLOR: Record<string, string> = {
  "new": "bg-gray-700 text-gray-300",
  "indeterminate": "bg-blue-900 text-blue-300",
  "done": "bg-green-900 text-green-300",
  "undefined": "bg-gray-700 text-gray-300",
};

interface Props {
  session: Session;
}

export function JiraPanel({ session }: Props) {
  const [ticket, setTicket] = useState<JiraTicket | null>(null);
  const [transitions, setTransitions] = useState<JiraTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasJira = !!session.meta.jiraTicket;

  async function fetchTicket() {
    setLoading(true);
    setError(null);
    try {
      const [tRes, trRes] = await Promise.all([
        fetch(`${BASE}/jira/ticket?sessionId=${session.meta.id}`),
        fetch(`${BASE}/jira/transitions?sessionId=${session.meta.id}`),
      ]);
      if (!tRes.ok) {
        const e = await tRes.json();
        setError(e.error ?? "Failed to fetch ticket");
        return;
      }
      setTicket(await tRes.json());
      setTransitions(trRes.ok ? await trRes.json() : []);
    } catch {
      setError("Could not reach server");
    } finally {
      setLoading(false);
    }
  }

  async function doTransition(transitionId: string) {
    setTransitioning(true);
    try {
      await fetch(`${BASE}/jira/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.meta.id, transitionId }),
      });
      await fetchTicket();
    } catch {
      setError("Transition failed");
    } finally {
      setTransitioning(false);
    }
  }

  if (!hasJira) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-500 text-xs">No JIRA ticket linked to this session.</p>
        <p className="text-gray-600 text-xs mt-1">Link one when creating a session.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">JIRA</span>
          <span className="text-xs text-blue-400">{session.meta.jiraTicket}</span>
        </div>
        <button
          onClick={fetchTicket}
          disabled={loading}
          className="px-2.5 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 rounded text-xs transition-colors"
        >
          {loading ? "Loading…" : ticket ? "Refresh" : "Load Ticket"}
        </button>
      </div>

      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {error && (
          <div className="px-3 py-2 bg-red-950/40 border border-red-700 rounded text-xs text-red-400">
            {error}
          </div>
        )}

        {ticket && (
          <>
            {/* Ticket info */}
            <div className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <a
                  href={ticket.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-300 hover:underline font-medium"
                >
                  {ticket.key}
                </a>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    STATUS_COLOR[ticket.statusCategory] ?? STATUS_COLOR["undefined"]
                  }`}
                >
                  {ticket.status}
                </span>
              </div>
              <p className="text-sm text-white">{ticket.summary}</p>
              <div className="flex gap-4 text-xs text-gray-500">
                {ticket.assignee && <span>👤 {ticket.assignee}</span>}
                {ticket.priority && <span>⚑ {ticket.priority}</span>}
              </div>
            </div>

            {/* Transitions */}
            {transitions.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-gray-500">Move to:</p>
                <div className="flex flex-wrap gap-2">
                  {transitions.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => doTransition(t.id)}
                      disabled={transitioning}
                      className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-xs transition-colors"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !error && !ticket && (
          <p className="text-gray-600 text-xs text-center py-4">
            Click "Load Ticket" to fetch JIRA status.
          </p>
        )}
      </div>
    </div>
  );
}
