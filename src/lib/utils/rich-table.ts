/**
 * Parses a table rendered by Python's Rich library (box-drawing borders,
 * `┃`-delimited header, `│`-delimited data rows) into structured rows. Used
 * to turn `hermes mcp list` / `hermes skills list` terminal output into JSON
 * without needing a `--json` flag that doesn't exist on those commands.
 */
export function parseRichTable(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split("\n");
  const headerLine = lines.find((l) => l.includes("┃"));
  const headers = headerLine
    ? headerLine
        .split("┃")
        .slice(1, -1)
        .map((c) => c.trim())
    : [];

  const rows = lines
    .filter((l) => l.trimStart().startsWith("│"))
    .map((l) =>
      l
        .split("│")
        .slice(1, -1)
        .map((c) => c.trim()),
    );

  return { headers, rows };
}

export function richRowsToObjects(headers: string[], rows: string[][]): Record<string, string>[] {
  return rows.map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
}
