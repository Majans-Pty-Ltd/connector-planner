import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PlannerClient } from "../api/client.js";
import type { PlannerTask, PlannerTaskDetails, GraphListResponse } from "../api/types.js";

const PRIORITY_MAP: Record<string, number> = {
  urgent: 0,
  important: 1,
  medium: 3,
  low: 5,
};

const PRIORITY_LABELS: Record<number, string> = {
  0: "Urgent",
  1: "Important",
  3: "Medium",
  5: "Low",
  9: "Unset",
};

function formatTask(t: PlannerTask) {
  return {
    id: t.id,
    title: t.title,
    bucket: t.bucketId,
    percentComplete: t.percentComplete,
    status: t.percentComplete === 100 ? "Completed" : t.percentComplete === 50 ? "In Progress" : "Not Started",
    priority: PRIORITY_LABELS[t.priority] ?? `Unknown (${t.priority})`,
    dueDate: t.dueDateTime ?? null,
    startDate: t.startDateTime ?? null,
    assignedTo: Object.keys(t.assignments ?? {}),
    created: t.createdDateTime,
    completed: t.completedDateTime ?? null,
  };
}

export function registerTaskTools(server: McpServer, client: PlannerClient): void {
  server.tool(
    "planner_list_tasks",
    "List all tasks in a Planner plan",
    {
      planId: z.string().describe("The plan ID"),
    },
    async ({ planId }) => {
      try {
        const result = await client.get<GraphListResponse<PlannerTask>>(
          `/planner/plans/${planId}/tasks`
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result.value.map(formatTask), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_list_bucket_tasks",
    "List all tasks in a specific bucket",
    {
      bucketId: z.string().describe("The bucket ID"),
    },
    async ({ bucketId }) => {
      try {
        const result = await client.get<GraphListResponse<PlannerTask>>(
          `/planner/buckets/${bucketId}/tasks`
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result.value.map(formatTask), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_my_tasks",
    "List all Planner tasks assigned to the authenticated user",
    {},
    async () => {
      try {
        const result = await client.get<GraphListResponse<PlannerTask>>(
          "/me/planner/tasks"
        );
        return {
          content: [{ type: "text", text: JSON.stringify(result.value.map(formatTask), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_get_task",
    "Get a specific task with its full details (description, checklist)",
    {
      taskId: z.string().describe("The task ID"),
    },
    async ({ taskId }) => {
      try {
        const [task, details] = await Promise.all([
          client.get<PlannerTask>(`/planner/tasks/${taskId}`),
          client.get<PlannerTaskDetails>(`/planner/tasks/${taskId}/details`),
        ]);
        const checklist = details.checklist
          ? Object.values(details.checklist).map((c) => ({
              title: c.title,
              isChecked: c.isChecked,
            }))
          : [];
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ...formatTask(task),
                  description: details.description || "",
                  checklist,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_create_task",
    "Create a new task in a Planner plan",
    {
      planId: z.string().describe("The plan ID"),
      title: z.string().describe("Task title"),
      bucketId: z.string().optional().describe("Bucket ID to place the task in"),
      assigneeIds: z.array(z.string()).optional().describe("Array of user IDs to assign"),
      dueDateTime: z.string().optional().describe("Due date in ISO 8601 format (e.g. 2025-03-15T00:00:00Z)"),
      startDateTime: z.string().optional().describe("Start date in ISO 8601 format"),
      priority: z.enum(["urgent", "important", "medium", "low"]).optional().describe("Task priority"),
      description: z.string().optional().describe("Task description / notes"),
    },
    async ({ planId, title, bucketId, assigneeIds, dueDateTime, startDateTime, priority, description }) => {
      try {
        const body: Record<string, unknown> = { planId, title, orderHint: " !" };
        if (bucketId) body.bucketId = bucketId;
        if (dueDateTime) body.dueDateTime = dueDateTime;
        if (startDateTime) body.startDateTime = startDateTime;
        if (priority) body.priority = PRIORITY_MAP[priority];
        if (assigneeIds?.length) {
          const assignments: Record<string, object> = {};
          for (const userId of assigneeIds) {
            assignments[userId] = {
              "@odata.type": "#microsoft.graph.plannerAssignment",
              orderHint: " !",
            };
          }
          body.assignments = assignments;
        }

        const task = await client.post<PlannerTask>("/planner/tasks", body);

        // Set description if provided (requires separate PATCH to task details)
        if (description) {
          // Small delay to let the task details resource become available
          await new Promise((r) => setTimeout(r, 500));
          try {
            await client.patchWithFreshEtag(`/planner/tasks/${task.id}/details`, {
              description,
            });
          } catch (descErr: any) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    { ...formatTask(task), warning: `Task created but description failed: ${descErr.message}` },
                    null,
                    2
                  ),
                },
              ],
            };
          }
        }

        return {
          content: [{ type: "text", text: JSON.stringify(formatTask(task), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_update_task",
    "Update an existing task (title, bucket, priority, dates, percent complete)",
    {
      taskId: z.string().describe("The task ID"),
      title: z.string().optional().describe("New title"),
      bucketId: z.string().optional().describe("Move to a different bucket"),
      percentComplete: z.number().min(0).max(100).optional().describe("0=Not started, 50=In progress, 100=Complete"),
      priority: z.enum(["urgent", "important", "medium", "low"]).optional().describe("Task priority"),
      dueDateTime: z.string().optional().describe("Due date in ISO 8601 format"),
      startDateTime: z.string().optional().describe("Start date in ISO 8601 format"),
      description: z.string().optional().describe("Update task description / notes"),
    },
    async ({ taskId, title, bucketId, percentComplete, priority, dueDateTime, startDateTime, description }) => {
      try {
        const taskBody: Record<string, unknown> = {};
        if (title !== undefined) taskBody.title = title;
        if (bucketId !== undefined) taskBody.bucketId = bucketId;
        if (percentComplete !== undefined) taskBody.percentComplete = percentComplete;
        if (priority !== undefined) taskBody.priority = PRIORITY_MAP[priority];
        if (dueDateTime !== undefined) taskBody.dueDateTime = dueDateTime;
        if (startDateTime !== undefined) taskBody.startDateTime = startDateTime;

        let updatedTask: PlannerTask | undefined;

        if (Object.keys(taskBody).length > 0) {
          updatedTask = await client.patchWithFreshEtag<PlannerTask>(
            `/planner/tasks/${taskId}`,
            taskBody
          );
        }

        if (description !== undefined) {
          await client.patchWithFreshEtag(`/planner/tasks/${taskId}/details`, {
            description,
          });
        }

        // Fetch final state
        const task = await client.get<PlannerTask>(`/planner/tasks/${taskId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(formatTask(task), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_assign_task",
    "Assign or unassign users from a task",
    {
      taskId: z.string().describe("The task ID"),
      addUserIds: z.array(z.string()).optional().describe("User IDs to assign to the task"),
      removeUserIds: z.array(z.string()).optional().describe("User IDs to unassign from the task"),
    },
    async ({ taskId, addUserIds, removeUserIds }) => {
      try {
        const assignments: Record<string, object | null> = {};
        if (addUserIds) {
          for (const userId of addUserIds) {
            assignments[userId] = {
              "@odata.type": "#microsoft.graph.plannerAssignment",
              orderHint: " !",
            };
          }
        }
        if (removeUserIds) {
          for (const userId of removeUserIds) {
            assignments[userId] = null as any;
          }
        }

        await client.patchWithFreshEtag(`/planner/tasks/${taskId}`, { assignments });
        const task = await client.get<PlannerTask>(`/planner/tasks/${taskId}`);
        return {
          content: [{ type: "text", text: JSON.stringify(formatTask(task), null, 2) }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "planner_delete_task",
    "Delete a task from a Planner plan",
    {
      taskId: z.string().describe("The task ID to delete"),
    },
    async ({ taskId }) => {
      try {
        await client.deleteWithFreshEtag(`/planner/tasks/${taskId}`);
        return {
          content: [{ type: "text", text: `Task ${taskId} deleted successfully.` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
