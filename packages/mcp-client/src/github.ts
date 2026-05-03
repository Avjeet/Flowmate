import type { IntegrationConfig } from "@flowmate/shared";

export interface GitHubPR {
  number: number;
  title: string;
  state: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GitHubComment {
  id: number;
  author: string;
  body: string;
  file?: string;
  line?: number;
  createdAt: string;
  resolved: boolean;
}

export class GitHubClient {
  private token: string;
  private baseUrl = "https://api.github.com";

  constructor(config: NonNullable<IntegrationConfig["github"]>) {
    this.token = config.token;
  }

  private async fetch(path: string, options: RequestInit = {}) {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers ?? {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${path}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  async testConnection(): Promise<{ login: string }> {
    const data = await this.fetch("/user");
    return { login: data.login };
  }

  async getPR(repo: string, prNumber: number): Promise<GitHubPR> {
    const data = await this.fetch(`/repos/${repo}/pulls/${prNumber}`);
    return {
      number: data.number,
      title: data.title,
      state: data.state,
      url: data.html_url,
      sourceBranch: data.head.ref,
      targetBranch: data.base.ref,
      author: data.user?.login ?? "unknown",
      draft: data.draft ?? false,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getPRComments(repo: string, prNumber: number): Promise<GitHubComment[]> {
    // Review comments (inline, on code)
    const reviewComments = await this.fetch(
      `/repos/${repo}/pulls/${prNumber}/comments?per_page=100`
    );
    // Issue-level comments (general PR comments)
    const issueComments = await this.fetch(
      `/repos/${repo}/issues/${prNumber}/comments?per_page=100`
    );

    const review: GitHubComment[] = (reviewComments ?? []).map((c: any) => ({
      id: c.id,
      author: c.user?.login ?? "unknown",
      body: c.body,
      file: c.path,
      line: c.line ?? c.original_line,
      createdAt: c.created_at,
      resolved: !!c.pull_request_review_id && c.subject_type === "line",
    }));

    const issue: GitHubComment[] = (issueComments ?? []).map((c: any) => ({
      id: c.id,
      author: c.user?.login ?? "unknown",
      body: c.body,
      createdAt: c.created_at,
      resolved: false,
    }));

    return [...review, ...issue];
  }

  async createPR(repo: string, opts: {
    title: string;
    body: string;
    head: string;
    base: string;
  }): Promise<GitHubPR> {
    const data = await this.fetch(`/repos/${repo}/pulls`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });
    return this.getPR(repo, data.number);
  }
}
