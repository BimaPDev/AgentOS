export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduleTicker } = await import("@/lib/schedules/ticker");
  startScheduleTicker();
}
