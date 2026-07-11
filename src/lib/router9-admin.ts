import "server-only";
import { getRouter9Connector } from "@/lib/connectors";
import type { Router9ConnectionInfo } from "@/lib/connectors/router9-connector";

export interface Router9Status {
  ok: boolean;
  latencyMs: number;
  modelCount?: number;
  error?: string;
  connection: Router9ConnectionInfo;
}

export async function getRouter9Status(): Promise<Router9Status> {
  const connector = getRouter9Connector();
  const info = connector.getConnectionInfo();
  const startedAt = Date.now();
  try {
    const models = await connector.listModels();
    return { ok: true, connection: info, latencyMs: Date.now() - startedAt, modelCount: models.length };
  } catch (err) {
    return {
      ok: false,
      connection: info,
      latencyMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
