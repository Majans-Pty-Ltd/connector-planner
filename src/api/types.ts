export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface PlannerPlan {
  id: string;
  title: string;
  owner: string;
  createdDateTime: string;
  createdBy?: { user?: { id: string; displayName?: string } };
  container?: { containerId: string; type: string };
  "@odata.etag"?: string;
}

export interface PlannerBucket {
  id: string;
  name: string;
  planId: string;
  orderHint: string;
  "@odata.etag"?: string;
}

export interface PlannerAssignment {
  "@odata.type": string;
  orderHint: string;
}

export interface PlannerTask {
  id: string;
  title: string;
  planId: string;
  bucketId?: string;
  percentComplete: number;
  priority: number;
  dueDateTime?: string;
  startDateTime?: string;
  createdDateTime: string;
  completedDateTime?: string;
  assignments: Record<string, PlannerAssignment | null>;
  appliedCategories?: Record<string, boolean>;
  createdBy?: { user?: { id: string; displayName?: string } };
  completedBy?: { user?: { id: string; displayName?: string } };
  "@odata.etag"?: string;
}

export interface PlannerTaskDetails {
  id: string;
  description: string;
  checklist?: Record<string, ChecklistItem>;
  references?: Record<string, Reference>;
  "@odata.etag"?: string;
}

export interface ChecklistItem {
  isChecked: boolean;
  title: string;
  orderHint: string;
}

export interface Reference {
  alias?: string;
  type?: string;
  previewPriority?: string;
}

export interface PlanDetails {
  id: string;
  categoryDescriptions?: Record<string, string>;
  "@odata.etag"?: string;
}

export interface GraphListResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}
