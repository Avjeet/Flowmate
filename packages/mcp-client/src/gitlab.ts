import type { IntegrationConfig } from "@flowmate/shared";

export interface GitLabComment {
  id: number;
  author: string;
  body: string;
  file?: string;
  line?: number;
  createdAt: string;
  resolved: boolean;
}

export interface GitLabMR {
  id: number;
  title: string;
  state: string;
  url: string;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  createdAt: string;
  updatedAt: string;
}

export class GitLabClient {
  private baseUrl: string;
  private token: string;

  constructor(config: NonNullable<IntegrationConfig["gitlab"]>) {
    this.baseUrl = `https://${config.host}/api/v4`;
    this.token = config.token;
  }

  private async fetch(path: string) {
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      headers: { "PRIVATE-TOKEN": this.token },
    });
    if (!res.ok) throw new Error(`GitLab API error ${res.status}: ${path}`);
    return res.json();
  }

  async getMR(projectPath: string, mrIid: string | number): Promise<GitLabMR> {
    const encoded = encodeURIComponent(projectPath);
    const data = await this.fetch(`/projects/${encoded}/merge_requests/${mrIid}`);
    return {
      id: data.iid,
      title: data.title,
      state: data.state,
      url: data.web_url,
      sourceBranch: data.source_branch,
      targetBranch: data.target_branch,
      author: data.author?.username ?? "unknown",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async getMRComments(projectPath: string, mrIid: string | number): Promise<GitLabComment[]> {
    const encoded = encodeURIComponent(projectPath);
    const notes = await this.fetch(
      `/projects/${encoded}/merge_requests/${mrIid}/notes?sort=asc&per_page=100`
    );
    return notes
      .filter((n: any) => !n.system)
      .map((n: any) => ({
        id: n.id,
        author: n.author?.username ?? "unknown",
        body: n.body,
        file: n.position?.new_path,
        line: n.position?.new_line,
        createdAt: n.created_at,
        resolved: n.resolved ?? false,
      }));
  }

  async getMRDiffComments(projectPath: string, mrIid: string | number): Promise<GitLabComment[]> {
    const encoded = encodeURIComponent(projectPath);
    const discussions = await this.fetch(
      `/projects/${encoded}/merge_requests/${mrIid}/discussions?per_page=100`
    );
    const comments: GitLabComment[] = [];
    for (const disc of discussions) {
      for (const note of disc.notes ?? []) {
        if (note.system) continue;
        comments.push({
          id: note.id,
          author: note.author?.username ?? "unknown",
          body: note.body,
          file: note.position?.new_path,
          line: note.position?.new_line,
          createdAt: note.created_at,
          resolved: disc.resolved ?? false,
        });
      }
    }
    return comments;
  }
}
