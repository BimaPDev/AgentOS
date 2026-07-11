import { HermesConnector } from "@/lib/connectors/hermes-connector";
import { MockConnector, type MockConnectorOptions } from "@/lib/connectors/mock-connector";
import type { AgentConnector } from "@/lib/connectors/types";
import type { ConnectorType } from "@/lib/types/domain";

let mockConnector: MockConnector | null = null;
let hermesConnector: HermesConnector | null = null;

/** Resolves the connector for a given `connectorType`. Both connectors are singletons reused across calls. */
export function getConnector(connectorType: ConnectorType, mockOptions?: MockConnectorOptions): AgentConnector {
  switch (connectorType) {
    case "mock":
      if (!mockConnector) mockConnector = new MockConnector(mockOptions);
      return mockConnector;
    case "hermes":
      if (!hermesConnector) hermesConnector = new HermesConnector();
      return hermesConnector;
  }
}

/** Same singleton as `getConnector("hermes")`, typed concretely for admin/status endpoints that need `runCommand`. */
export function getHermesConnector(): HermesConnector {
  if (!hermesConnector) hermesConnector = new HermesConnector();
  return hermesConnector;
}
