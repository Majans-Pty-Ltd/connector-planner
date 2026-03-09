#!/usr/bin/env node

/**
 * Interactive setup script — run once per user to authenticate with Microsoft.
 * Opens a browser for consent, receives the auth code via a local callback server,
 * exchanges it for tokens, and stores them in .tokens.json.
 *
 * Usage: npm run build && npm run setup
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { validateConfig, TENANT_ID, CLIENT_ID, CLIENT_SECRET } from "./utils/config.js";
import { storeInitialTokens } from "./api/token-manager.js";
import { log, logError } from "./utils/logger.js";
import type { TokenResponse } from "./api/types.js";

const REDIRECT_PORT = 3847;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPES = "https://graph.microsoft.com/Tasks.ReadWrite https://graph.microsoft.com/Group.Read.All https://graph.microsoft.com/User.Read offline_access";

async function main(): Promise<void> {
  validateConfig();

  const authUrl = new URL(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPES);
  authUrl.searchParams.set("response_mode", "query");

  log("Starting auth server on port", REDIRECT_PORT);
  log("");
  log("Open this URL in your browser to authenticate:");
  log("");
  log(authUrl.toString());
  log("");

  // Try to open browser automatically
  try {
    const open = (await import("open")).default;
    await open(authUrl.toString());
    log("Browser opened automatically.");
  } catch {
    log("Could not open browser automatically. Please open the URL above manually.");
  }

  // Start local HTTP server to receive the callback
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://localhost:${REDIRECT_PORT}`);

    if (url.pathname !== "/callback") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error) {
      const desc = url.searchParams.get("error_description") ?? error;
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>Authentication Failed</h1><p>${desc}</p><p>You can close this tab.</p>`);
      logError("Auth failed", desc);
      process.exit(1);
    }

    if (!code) {
      res.writeHead(400, { "Content-Type": "text/html" });
      res.end(`<h1>No auth code received</h1><p>You can close this tab.</p>`);
      return;
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code,
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
          }),
        }
      );

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        throw new Error(`Token exchange failed (${tokenRes.status}): ${text}`);
      }

      const tokens = (await tokenRes.json()) as TokenResponse;
      storeInitialTokens(tokens);

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(
        `<h1>✅ Authentication Successful</h1>
         <p>Tokens stored. You can close this tab and start the connector.</p>
         <p><code>npm start</code></p>`
      );

      log("");
      log("Authentication successful! Tokens saved.");
      log("You can now start the connector with: npm start");
      log("");

      // Give the response time to send, then exit
      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    } catch (err: any) {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end(`<h1>Token Exchange Failed</h1><p>${err.message}</p>`);
      logError("Token exchange failed", err);
      process.exit(1);
    }
  });

  server.listen(REDIRECT_PORT);
}

main().catch((err) => {
  logError("Setup failed", err);
  process.exit(1);
});
