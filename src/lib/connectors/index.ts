import { MockConnector, type MockConnectorOptions } from "@/lib/connectors/mock-connector";
import type { AgentConnector } from "@/lib/connectors/types";
import type { ConnectorType } from "@/lib/types/domain";

let mockConnector: MockConnector | null = null;

/**
 * Resolves the connector for a given `connectorType`. Today only `'mock'`
 * is implemented. `'hermes'` is a valid value at the data-model level so
 * agents can be pre-configured for it, but selecting it throws until a real
 * `HermesConnector` is added here — no other code needs to change when that
 * happens.
 */
export function getConnector(connectorType: ConnectorType, mockOptions?: MockConnectorOptions): AgentConnector {
  switch (connectorType) {
    case "mock":
      if (!mockConnector) mockConnector = new MockConnector(mockOptions);
      return mockConnector;
    case "hermes":
      throw new Error(
        "Hermes connector is not implemented yet. Add a HermesConnector implementing AgentConnector and register it here.",
      );
  }
}
