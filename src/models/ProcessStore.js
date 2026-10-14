export class ProcessStore {
  constructor() {
    this.items = [];
    this.services = [];
    this.query = "";
    this.sort = "cpu";
    this.reverse = false;
    this.mode = "process";
  }
  update(items) {
    this.items = items;
  }
  updateServices(items) {
    this.services = items ?? [];
  }
  visible() {
    const query = this.query.trim().toLowerCase();
    if (this.mode === "services") {
      return this.services
        .map((service, index) => ({
          pid: service.pids?.[0] ?? "-",
          parentPid: null,
          name: service.name,
          command: service.startmode ?? "service",
          threads: service.pids?.length ?? 0,
          user: service.running ? "running" : "stopped",
          memRss: 0,
          cpu: service.cpu ?? 0,
          state: service.running ? "running" : "stopped",
          _index: index,
        }))
        .filter((p) =>
          `${p.pid} ${p.name} ${p.user}`.toLowerCase().includes(query),
        );
    }
    const rows = this.items
      .filter((p) =>
        `${p.pid} ${p.name} ${p.user ?? ""}`.toLowerCase().includes(query),
      )
      .sort((a, b) => {
        const order =
          this.sort === "name"
            ? String(a.name).localeCompare(String(b.name))
            : (b[this.sort] || 0) - (a[this.sort] || 0);
        return (this.reverse ? -order : order) || a.pid - b.pid;
      });
    if (this.mode !== "tree") return rows;
    const pidSet = new Set(this.items.map((p) => p.pid));
    return rows.map((p) => ({
      ...p,
      displayName: `${pidSet.has(p.parentPid) ? "└─" : "• "}${p.name}`,
    }));
  }
  cycleSort() {
    const fields = ["cpu", "memRss", "pid", "name"];
    this.sort = fields[(fields.indexOf(this.sort) + 1) % fields.length];
  }
  cycleMode() {
    const modes = ["process", "tree", "services"];
    this.mode = modes[(modes.indexOf(this.mode) + 1) % modes.length];
  }
}
