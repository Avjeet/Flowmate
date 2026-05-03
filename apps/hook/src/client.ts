const BASE = `http://localhost:${process.env.FLOWMATE_PORT ?? 7842}/api`;

export async function apiGet(path: string) {
  try {
    const r = await fetch(`${BASE}${path}`);
    return r.json();
  } catch {
    return null;
  }
}

export async function apiPost(path: string, body: object = {}) {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  } catch {
    return null;
  }
}

export async function getActiveSession() {
  return apiGet("/sessions/active");
}

export async function pollForApproval(sessionId: string, timeoutMs = 300_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await Bun.sleep(2000);
    const session = await apiGet(`/sessions/${sessionId}`);
    if (!session) return false;
    if (!session.state.waitingFor) return true;
  }
  return false; // timed out — let agent continue
}
