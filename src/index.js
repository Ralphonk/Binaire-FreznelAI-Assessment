import { SystemService } from "./api/SystemService.js";
import { TerminalApp } from "./components/TerminalApp.js";

if (process.argv.includes("--check")) {
  const sample = await new SystemService().sample();
  console.log(
    JSON.stringify(
      {
        cpu: sample.cpu,
        processes: sample.processes.length,
        memoryAvailable: Boolean(sample.memory),
        disks: sample.disks.length,
        gpu: sample.graphics[0]?.model ?? null,
        services: sample.services.length,
        processesWithThreads: sample.processes.filter((item) =>
          Number.isFinite(item.threads),
        ).length,
        processesWithUser: sample.processes.filter((item) => item.user).length,
        unavailable: sample.errors,
      },
      null,
      2,
    ),
  );
  process.exit(0);
} else if (!process.stdin.isTTY || !process.stdout.isTTY) {
  console.error(
    "Open an interactive terminal to run this UI. Use npm run check for a diagnostic sample.",
  );
  process.exitCode = 1;
} else {
  new TerminalApp().start(process.argv.includes("--local"));
}
