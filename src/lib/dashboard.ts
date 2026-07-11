import { listAgents } from "@/lib/db/queries/agents";
import { listAllRuns, listRuns, listRunNodeStates } from "@/lib/db/queries/runs";
import { ROOT_GRAPH_ID, type ConnectorType, type RunStatus } from "@/lib/types/domain";

export interface DashboardStats {
  agentCount: number;
  totalRuns: number;
  /** success / (success + error) over finished runs, as a 0–100 percent; null when no finished runs. */
  successRate: number | null;
  activeRuns: number;
  statusCounts: Record<RunStatus, number>;
}

export interface DashboardAgent {
  id: string;
  name: string;
  role: string | null;
  connectorType: ConnectorType;
  lastRunStatus: RunStatus | null;
  lastRunAt: string | null;
}

export interface ActivityItem {
  runId: string;
  graphId: string;
  label: string;
  status: RunStatus;
  startedAt: string;
  finishedAt: string | null;
  triggeredBy: string;
  responseSnippet: string | null;
}

export interface DashboardData {
  stats: DashboardStats;
  agents: DashboardAgent[];
  activity: ActivityItem[];
  generatedAt: string;
}

const RESPONSE_SNIPPET_MAX = 160;

export function labelForGraph(graphId: string, agentNameById: Map<string, string>): string {
  if (graphId === ROOT_GRAPH_ID) return "Orchestration graph";
  const agentName = agentNameById.get(graphId);
  return agentName ? `${agentName} · pipeline` : "Pipeline";
}

/** The "response" surfaced for a run: last successful output, else an error message, else null. */
function responseSnippetForRun(runId: string): string | null {
  const states = listRunNodeStates(runId);
  const withOutput = states
    .filter((s) => s.outputText && s.outputText.trim().length > 0)
    .sort((a, b) => (a.finishedAt ?? "").localeCompare(b.finishedAt ?? ""));
  const last = withOutput.at(-1);
  let text: string | null = null;
  if (last?.outputText) {
    text = last.outputText.trim();
  } else {
    const errored = states.find((s) => s.errorText);
    text = errored?.errorText?.trim() ?? null;
  }
  if (!text) return null;
  return text.length > RESPONSE_SNIPPET_MAX ? text.slice(0, RESPONSE_SNIPPET_MAX).trimEnd() + "…" : text;
}

export function getDashboardData(activityLimit = 8): DashboardData {
  const agents = listAgents();
  const allRuns = listAllRuns();
  const recentRuns = listRuns(activityLimit);

  const agentNameById = new Map(agents.map((a) => [a.id, a.name]));

  const statusCounts: Record<RunStatus, number> = { idle: 0, running: 0, success: 0, error: 0 };
  for (const run of allRuns) {
    statusCounts[run.status] = (statusCounts[run.status] ?? 0) + 1;
  }
  const finished = statusCounts.success + statusCounts.error;
  const successRate = finished > 0 ? Math.round((statusCounts.success / finished) * 100) : null;

  // Most recent run per agent-owned graph (graphId === agent.id).
  const lastRunByGraph = new Map<string, { status: RunStatus; startedAt: string }>();
  for (const run of allRuns) {
    const existing = lastRunByGraph.get(run.graphId);
    if (!existing || run.startedAt > existing.startedAt) {
      lastRunByGraph.set(run.graphId, { status: run.status, startedAt: run.startedAt });
    }
  }

  const dashboardAgents: DashboardAgent[] = agents.map((a) => {
    const last = lastRunByGraph.get(a.id);
    return {
      id: a.id,
      name: a.name,
      role: a.role,
      connectorType: a.connectorType,
      lastRunStatus: last?.status ?? null,
      lastRunAt: last?.startedAt ?? null,
    };
  });

  const activity: ActivityItem[] = recentRuns.map((run) => ({
    runId: run.id,
    graphId: run.graphId,
    label: labelForGraph(run.graphId, agentNameById),
    status: run.status,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    triggeredBy: run.triggeredBy,
    responseSnippet: responseSnippetForRun(run.id),
  }));

  return {
    stats: {
      agentCount: agents.length,
      totalRuns: allRuns.length,
      successRate,
      activeRuns: statusCounts.running,
      statusCounts,
    },
    agents: dashboardAgents,
    activity,
    generatedAt: new Date().toISOString(),
  };
}
