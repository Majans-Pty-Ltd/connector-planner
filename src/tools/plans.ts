import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PlannerClient } from "../api/client.js";
import type { PlannerPlan, PlanDetails, GraphListResponse } from "../api/types.js";

export function registerPlanTools(server: McpServer, client: PlannerClient): void {
  server.tool(
    "planner_list_plans",
    "List Planner plans for a Microsoft 365 Group",
    {
      groupId: z.string().describe("The M365 Group ID that owns the plans"),
    },
    async ({ groupId }) => {
      try {
        const result = await client.get<GraphListResponse<PlannerPlan>>(
          `/groups/${groupId}/planner/plans`
        );
        const plans = result.value.map((p) => ({
          id: p.id,
          title: p.title,
          owner: p.owner,
          createdDateTime: p.createdDateTime,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(plans, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_my_plans",
    "List Planner plans for the authenticated user",
    {},
    async () => {
      try {
        const result = await client.get<GraphListResponse<PlannerPlan>>(
          "/me/planner/plans"
        );
        const plans = result.value.map((p) => ({
          id: p.id,
          title: p.title,
          owner: p.owner,
          createdDateTime: p.createdDateTime,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(plans, null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_get_plan",
    "Get details of a specific Planner plan including category labels",
    {
      planId: z.string().describe("The plan ID"),
    },
    async ({ planId }) => {
      try {
        const [plan, details] = await Promise.all([
          client.get<PlannerPlan>(`/planner/plans/${planId}`),
          client.get<PlanDetails>(`/planner/plans/${planId}/details`),
        ]);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ...plan, categoryDescriptions: details.categoryDescriptions }, null, 2),
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
