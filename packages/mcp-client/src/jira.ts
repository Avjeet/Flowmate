import type { IntegrationConfig } from "@flowmate/shared";

export interface JiraTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  assignee?: string;
  priority?: string;
  url: string;
  updatedAt: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  toStatus: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: NonNullable<IntegrationConfig["jira"]>) {
    this.baseUrl = `https://${config.host}/rest/api/3`;
    this.authHeader =
      "Basic " + Buffer.from(`${config.email}:${config.token}`).toString("base64");
  }

  private async fetch(path: string, options: RequestInit = {}) {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`JIRA API error ${res.status}: ${path}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async getTicket(key: string): Promise<JiraTicket> {
    const data = await this.fetch(`/issue/${key}`);
    return {
      key: data.key,
      summary: data.fields.summary,
      status: data.fields.status.name,
      statusCategory: data.fields.status.statusCategory.key,
      assignee: data.fields.assignee?.displayName,
      priority: data.fields.priority?.name,
      url: `https://${new URL(this.baseUrl).host}/browse/${data.key}`,
      updatedAt: data.fields.updated,
    };
  }

  async getTransitions(key: string): Promise<JiraTransition[]> {
    const data = await this.fetch(`/issue/${key}/transitions`);
    return (data.transitions ?? []).map((t: any) => ({
      id: t.id,
      name: t.name,
      toStatus: t.to?.name ?? t.name,
    }));
  }

  async doTransition(key: string, transitionId: string): Promise<void> {
    await this.fetch(`/issue/${key}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async addComment(key: string, body: string): Promise<void> {
    await this.fetch(`/issue/${key}/comment`, {
      method: "POST",
      body: JSON.stringify({
        body: {
          type: "doc",
          version: 1,
          content: [{ type: "paragraph", content: [{ type: "text", text: body }] }],
        },
      }),
    });
  }

  async createStory(projectKey: string, summary: string, description?: string): Promise<JiraTicket> {
    const data = await this.fetch("/issue", {
      method: "POST",
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary,
          issuetype: { name: "Story" },
          ...(description
            ? {
                description: {
                  type: "doc",
                  version: 1,
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: description }],
                    },
                  ],
                },
              }
            : {}),
        },
      }),
    });
    // Fetch the full issue to get status, etc.
    return this.getTicket(data.key);
  }

  async createSubtask(parentKey: string, summary: string): Promise<JiraTicket> {
    // Get project key from parent
    const parent = await this.getTicket(parentKey);
    const projectKey = parent.key.split("-")[0];
    const data = await this.fetch("/issue", {
      method: "POST",
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary,
          issuetype: { name: "Subtask" },
          parent: { key: parentKey },
        },
      }),
    });
    return this.getTicket(data.key);
  }
}
