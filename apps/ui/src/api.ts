export const BASE = `http://localhost:${import.meta.env.VITE_SERVER_PORT ?? 7842}/api`;

export async function getSessions() {
  const r = await fetch(`${BASE}/sessions`);
  return r.json();
}

export async function getActiveSession() {
  const r = await fetch(`${BASE}/sessions/active`);
  return r.json();
}

export async function createSession(data: {
  name: string;
  agentType?: string;
  cwd?: string;
  jiraTicket?: string;
  gitlabRepo?: string;
  gitlabMR?: string;
}) {
  const r = await fetch(`${BASE}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return r.json();
}

export async function approve(sessionId: string) {
  const r = await fetch(`${BASE}/sessions/${sessionId}/approve`, { method: "POST" });
  return r.json();
}

export async function endSession(sessionId: string) {
  const r = await fetch(`${BASE}/sessions/${sessionId}/end`, { method: "POST" });
  return r.json();
}

export async function getConfig() {
  const r = await fetch(`${BASE}/config`);
  return r.json();
}

export async function saveConfig(config: object) {
  await fetch(`${BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
}
