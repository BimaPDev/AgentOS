"use client";

import { useState } from "react";

const PRESETS = [
  { label: "Every 15 minutes", minutes: 15 },
  { label: "Every hour", minutes: 60 },
  { label: "Every 6 hours", minutes: 360 },
  { label: "Every day", minutes: 1440 },
] as const;

interface ScheduleAgentModalProps {
  agentName: string;
  initialMinutes?: number;
  onClose: () => void;
  onSave: (intervalMinutes: number) => Promise<void> | void;
}

export function ScheduleAgentModal({
  agentName,
  initialMinutes = 60,
  onClose,
  onSave,
}: ScheduleAgentModalProps) {
  const [minutes, setMinutes] = useState(initialMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave(minutes);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`Schedule ${agentName}`}
        className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Schedule run</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Automatically run <span className="font-medium text-zinc-700 dark:text-zinc-200">{agentName}</span> on
          an interval. The first run is after one full interval.
        </p>

        <div className="mt-4 space-y-2">
          {PRESETS.map((preset) => (
            <label
              key={preset.minutes}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${
                minutes === preset.minutes
                  ? "border-indigo-500 bg-indigo-50 text-indigo-900 dark:border-indigo-400 dark:bg-indigo-950/40 dark:text-indigo-100"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              <input
                type="radio"
                name="interval"
                checked={minutes === preset.minutes}
                onChange={() => setMinutes(preset.minutes)}
                className="accent-indigo-600"
              />
              {preset.label}
            </label>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-300 px-3.5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void submit()}
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
