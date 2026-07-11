"use client";

import type {
  ConditionStepConfig,
  NodeConfig,
  NodeType,
  OutputStepConfig,
  PromptStepConfig,
  ToolCallStepConfig,
} from "@/lib/types/domain";

interface PromptConfigFormProps {
  type: Exclude<NodeType, "agent">;
  config: NodeConfig;
  onChange: (config: NodeConfig) => void;
}

const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:border-indigo-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const labelClass = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1";

export function PromptConfigForm({ type, config, onChange }: PromptConfigFormProps) {
  if (type === "prompt") {
    const c = config as PromptStepConfig;
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Prompt</label>
          <textarea
            className={inputClass}
            rows={5}
            value={c.prompt ?? ""}
            onChange={(e) => onChange({ ...c, prompt: e.target.value })}
            placeholder="What should this step ask the agent?"
          />
        </div>
        <div>
          <label className={labelClass}>System prompt (optional)</label>
          <textarea
            className={inputClass}
            rows={3}
            value={c.systemPrompt ?? ""}
            onChange={(e) => onChange({ ...c, systemPrompt: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Temperature</label>
          <input
            type="number"
            step={0.1}
            min={0}
            max={2}
            className={inputClass}
            value={c.temperature ?? 0.7}
            onChange={(e) => onChange({ ...c, temperature: Number(e.target.value) })}
          />
        </div>
      </div>
    );
  }

  if (type === "tool-call") {
    const c = config as ToolCallStepConfig;
    return (
      <div className="flex flex-col gap-3">
        <div>
          <label className={labelClass}>Tool name</label>
          <input
            className={inputClass}
            value={c.toolName ?? ""}
            onChange={(e) => onChange({ ...c, toolName: e.target.value })}
            placeholder="e.g. web_search"
          />
        </div>
        <div>
          <label className={labelClass}>Tool arguments (JSON)</label>
          <textarea
            className={inputClass}
            rows={5}
            value={JSON.stringify(c.toolArgs ?? {}, null, 2)}
            onChange={(e) => {
              try {
                onChange({ ...c, toolArgs: JSON.parse(e.target.value || "{}") });
              } catch {
                // ignore invalid JSON while typing; last valid value is kept
              }
            }}
          />
        </div>
      </div>
    );
  }

  if (type === "condition") {
    const c = config as ConditionStepConfig;
    return (
      <div>
        <label className={labelClass}>Condition expression</label>
        <input
          className={inputClass}
          value={c.expression ?? ""}
          onChange={(e) => onChange({ ...c, expression: e.target.value })}
          placeholder="e.g. contains(output, 'yes')"
        />
      </div>
    );
  }

  const c = config as OutputStepConfig;
  return (
    <div>
      <label className={labelClass}>Output format</label>
      <select
        className={inputClass}
        value={c.format ?? "text"}
        onChange={(e) => onChange({ ...c, format: e.target.value as OutputStepConfig["format"] })}
      >
        <option value="text">Text</option>
        <option value="json">JSON</option>
      </select>
    </div>
  );
}
