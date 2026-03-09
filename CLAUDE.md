# connector-planner

MCP connector for Microsoft Planner via Graph API. Provides tools to manage plans, buckets, and tasks.

## Tech Stack
- TypeScript + Node.js (ESM)
- MCP SDK (`@modelcontextprotocol/sdk`) with stdio transport
- Microsoft Graph API v1.0 (Planner endpoints)
- Delegated auth (auth code + refresh token) — NOT client credentials

## Auth
Planner API requires **delegated permissions** (no app-only support). Each user runs `npm run setup` once to authenticate via browser, which stores a refresh token in `.tokens.json` (git-ignored). The connector auto-refreshes silently.

**Required Entra ID permissions** (delegated, admin-consented):
- `Tasks.ReadWrite` — Read/write Planner tasks
- `Group.Read.All` — List groups and their plans
- `User.Read` — Read authenticated user profile
- `offline_access` — Refresh tokens

**Entra app redirect URI**: `http://localhost:3847/callback` (Web platform)

## Key Commands
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run setup        # One-time interactive auth (opens browser)
npm start            # Run MCP server (stdio)
```

## Tools (12 total)

### Plans
- `planner_list_plans` — List plans for a M365 Group
- `planner_my_plans` — List authenticated user's plans
- `planner_get_plan` — Get plan details + category labels

### Buckets
- `planner_list_buckets` — List buckets in a plan
- `planner_create_bucket` — Create a new bucket

### Tasks
- `planner_list_tasks` — List all tasks in a plan
- `planner_list_bucket_tasks` — List tasks in a specific bucket
- `planner_my_tasks` — List tasks assigned to the authenticated user
- `planner_get_task` — Get task with description + checklist
- `planner_create_task` — Create a task (with optional assignees, priority, description)
- `planner_update_task` — Update task fields (title, bucket, priority, dates, completion, description)
- `planner_assign_task` — Assign/unassign users
- `planner_delete_task` — Delete a task

## Architecture Notes
- **ETag handling**: All mutations (PATCH/DELETE) require `If-Match` header with the resource's current ETag. The client auto-fetches the ETag before mutating via `patchWithFreshEtag()` / `deleteWithFreshEtag()`.
- **Task details are separate**: Description and checklist live on `plannerTaskDetails`, not the task itself. Create/update handles this transparently.
- **No $filter on Planner**: The API has very limited OData query support — filtering is done client-side.
- **Priority mapping**: urgent=0, important=1, medium=3, low=5 (Graph API uses integers).

## Secrets
All credentials via 1Password `op://Majans Dev/Planner MCP Connector/`.
