import type {
  ConditionStepConfig,
  GraphNode,
  OutputStepConfig,
  PromptStepConfig,
  ToolCallStepConfig,
} from "@/lib/types/domain";

/** Resolve the instruction text for a pipeline step node. */
export function seedPromptForNode(node: GraphNode): string {
  switch (node.type) {
    case "prompt":
      return (node.config as PromptStepConfig).prompt || "(no prompt configured)";
    case "tool-call": {
      const config = node.config as ToolCallStepConfig;
      return config.toolName ? `Call tool ${config.toolName}` : "(no tool configured)";
    }
    case "condition":
      return (node.config as ConditionStepConfig).expression || "(no condition configured)";
    case "output":
      return `Format output as ${(node.config as OutputStepConfig).format ?? "text"}`;
    default:
      return "";
  }
}
