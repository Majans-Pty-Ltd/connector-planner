import { readFileSync, writeFileSync, existsSync } from "fs";
import { TENANT_ID, CLIENT_ID, CLIENT_SECRET, TOKENS_PATH } from "../utils/config.js";
import { log, logError } from "../utils/logger.js";
import type { TokenResponse, StoredTokens } from "./types.js";

let tokenCache: StoredTokens | null = null;

const TOKEN_URL = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;

function loadTokens(): StoredTokens | null {
  if (tokenCache) return tokenCache;
  if (!existsSync(TOKENS_PATH)) return null;
  try {
    const data = JSON.parse(readFileSync(TOKENS_PATH, "utf-8")) as StoredTokens;
    tokenCache = data;
    return data;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StoredTokens): void {
  tokenCache = tokens;
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

async function refreshAccessToken(refreshToken: string): Promise<StoredTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
      scope: "https://graph.microsoft.com/Tasks.ReadWrite Group.Read.All User.Read offline_access",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as TokenResponse;
  const tokens: StoredTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  saveTokens(tokens);
  log("Token refreshed successfully");
  return tokens;
}

export async function getAccessToken(): Promise<string> {
  let tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "No tokens found. Run 'npm run setup' to authenticate first."
    );
  }

  // Refresh if within 60 seconds of expiry
  if (tokens.expiresAt < Date.now() + 60_000) {
    log("Token expired or expiring, refreshing...");
    tokens = await refreshAccessToken(tokens.refreshToken);
  }

  return tokens.accessToken;
}

export function storeInitialTokens(tokenResponse: TokenResponse): void {
  if (!tokenResponse.refresh_token) {
    throw new Error("No refresh token received. Ensure offline_access scope is requested.");
  }
  const tokens: StoredTokens = {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    expiresAt: Date.now() + tokenResponse.expires_in * 1000,
  };
  saveTokens(tokens);
  log("Initial tokens stored at", TOKENS_PATH);
}
