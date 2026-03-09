import { getAccessToken } from "./token-manager.js";
import { logError } from "../utils/logger.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export class PlannerClient {
  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<T> {
    const token = await getAccessToken();
    const url = `${GRAPH_BASE}${path}`;

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (res.status === 204) return {} as T;

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Graph API ${method} ${path} failed (${res.status}): ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async patch<T>(path: string, body: Record<string, unknown>, etag: string): Promise<T> {
    return this.request<T>("PATCH", path, body, { "If-Match": etag });
  }

  async delete(path: string, etag: string): Promise<void> {
    await this.request<void>("DELETE", path, undefined, { "If-Match": etag });
  }

  /** GET the resource to fetch current ETag, then PATCH with it. */
  async patchWithFreshEtag<T>(
    path: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const current = await this.get<{ "@odata.etag": string }>(path);
    const etag = current["@odata.etag"];
    if (!etag) throw new Error(`No ETag found on ${path}`);
    return this.patch<T>(path, body, etag);
  }

  /** GET the resource to fetch current ETag, then DELETE with it. */
  async deleteWithFreshEtag(path: string): Promise<void> {
    const current = await this.get<{ "@odata.etag": string }>(path);
    const etag = current["@odata.etag"];
    if (!etag) throw new Error(`No ETag found on ${path}`);
    await this.delete(path, etag);
  }
}
