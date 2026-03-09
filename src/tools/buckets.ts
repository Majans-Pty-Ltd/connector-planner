import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PlannerClient } from "../api/client.js";
import type { PlannerBucket, GraphListResponse } from "../api/types.js";

export function registerBucketTools(server: McpServer, client: PlannerClient): void {
  server.tool(
    "planner_list_buckets",
    "List all buckets (columns) in a Planner plan",
    {
      planId: z.string().describe("The plan ID"),
    },
    async ({ planId }) => {
      try {
        const result = await client.get<GraphListResponse<PlannerBucket>>(
          `/planner/plans/${planId}/buckets`
        );
        const buckets = result.value.map((b) => ({
          id: b.id,
          name: b.name,
          planId: b.planId,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(buckets, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_create_bucket",
    "Create a new bucket (column) in a Planner plan",
    {
      planId: z.string().describe("The plan ID"),
      name: z.string().describe("Bucket name"),
    },
    async ({ planId, name }) => {
      try {
        const bucket = await client.post<PlannerBucket>("/planner/buckets", {
          planId,
          name,
          orderHint: " !",
        });
        return {
          content: [{ type: "text", text: JSON.stringify({ id: bucket.id, name: bucket.name }, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
