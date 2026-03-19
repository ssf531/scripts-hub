export interface AiTask {
  id: number;
  type: string;
  description: string;
  model: string;
  status: "Pending" | "Running" | "Completed" | "Failed";
  output: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  prompt?: string; // only returned by GET /api/ai-tasks/{id}
}

export interface AiTaskPage {
  total: number;
  page: number;
  pageSize: number;
  items: AiTask[];
}

export interface EnqueueRequest {
  type?: string;
  description?: string;
  prompt: string;
  model?: string;
}

export async function getAiTasks(params?: {
  status?: string;
  type?: string;
  page?: number;
  pageSize?: number;
}): Promise<AiTaskPage> {
  const qs = new URLSearchParams();
  if (params?.status)   qs.set("status", params.status);
  if (params?.type)     qs.set("type", params.type);
  if (params?.page)     qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const res = await fetch(`/api/ai-tasks?${qs}`);
  if (!res.ok) throw new Error(`Failed to load AI tasks: ${await res.text()}`);
  return res.json();
}

export async function getAiTask(id: number): Promise<AiTask> {
  const res = await fetch(`/api/ai-tasks/${id}`);
  if (!res.ok) throw new Error(`Failed to load AI task ${id}: ${await res.text()}`);
  return res.json();
}

export async function enqueueAiTask(req: EnqueueRequest): Promise<{ taskId: number }> {
  const res = await fetch("/api/ai-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`Failed to enqueue AI task: ${await res.text()}`);
  return res.json();
}

export async function deleteAiTask(id: number): Promise<void> {
  const res = await fetch(`/api/ai-tasks/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to delete AI task ${id}: ${await res.text()}`);
}
