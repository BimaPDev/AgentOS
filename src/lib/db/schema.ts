import { sql } from "drizzle-orm";
import { sqliteTable, text, real, integer, index } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role"),
  description: text("description"),
  connectorType: text("connector_type").notNull().default("mock"),
  workspaceFolder: text("workspace_folder"),
  model: text("model"),
  positionX: real("position_x").notNull().default(0),
  positionY: real("position_y").notNull().default(0),
  color: text("color"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const nodes = sqliteTable(
  "nodes",
  {
    id: text("id").primaryKey(),
    graphId: text("graph_id").notNull(),
    type: text("type").notNull(),
    refAgentId: text("ref_agent_id").references(() => agents.id, { onDelete: "cascade" }),
    label: text("label"),
    positionX: real("position_x").notNull(),
    positionY: real("position_y").notNull(),
    configJson: text("config_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("nodes_graph_id_idx").on(table.graphId)],
);

export const edges = sqliteTable(
  "edges",
  {
    id: text("id").primaryKey(),
    graphId: text("graph_id").notNull(),
    sourceNodeId: text("source_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    targetNodeId: text("target_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    sourceHandle: text("source_handle"),
    targetHandle: text("target_handle"),
    label: text("label"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("edges_graph_id_idx").on(table.graphId),
    index("edges_source_node_id_idx").on(table.sourceNodeId),
    index("edges_target_node_id_idx").on(table.targetNodeId),
  ],
);

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  graphId: text("graph_id").notNull(),
  status: text("status").notNull().default("idle"),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  triggeredBy: text("triggered_by").notNull().default("user"),
});

export const runNodeStates = sqliteTable(
  "run_node_states",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    nodeId: text("node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("idle"),
    inputText: text("input_text"),
    outputText: text("output_text"),
    errorText: text("error_text"),
    startedAt: text("started_at"),
    finishedAt: text("finished_at"),
  },
  (table) => [index("run_node_states_run_id_idx").on(table.runId)],
);

export const runLogs = sqliteTable(
  "run_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id").notNull(),
    nodeId: text("node_id"),
    ts: text("ts").notNull().default(sql`(current_timestamp)`),
    level: text("level").notNull().default("info"),
    message: text("message").notNull(),
  },
  (table) => [index("run_logs_run_id_idx").on(table.runId)],
);
