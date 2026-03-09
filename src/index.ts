#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateConfig } from "./utils/config.js";
import { PlannerClient } from "./api/client.js";
import { registerPlanTools } from "./tools/plans.js";
import { registerBucketTools } from "./tools/buckets.js";
import { registerTaskTools } from "./tools/tasks.js";
import { log, logError } from "./utils/logger.js";

async function main(): Promise<void> {
  validateConfig();

  const client = new PlannerClient();

  const server = new McpServer({
    name: "connector-planner",
    version: "1.0.0",
  });

  registerPlanTools(server, client);
  registerBucketTools(server, client);
  registerTaskTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("MCP server started (stdio)");
}

main().catch((err) => {
  logError("Failed to start MCP server", err);
  process.exit(1);
});
