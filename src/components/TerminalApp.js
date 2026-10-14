import blessed from "blessed";
import { renderReference, renderProcesses } from "./ReferenceView.js";
import { SystemService } from "../api/SystemService.js";
import { FirebaseAuth } from "../auth/FirebaseAuth.js";
import { ProcessStore } from "../models/ProcessStore.js";
import { bar, bytes, clean, graph, percent } from "../utils/format.js";

const colors = {
  green: "#9acb89",
  purple: "#b99ae0",
  blue: "#8cbce6",
  muted: "#7d8794",
  text: "#d3d8df",
  bg: "#080a0b",
};
export class TerminalApp {
  constructor(screenOptions = {}) {
    this.service = new SystemService();
    this.auth = new FirebaseAuth();
    this.store = new ProcessStore();
    this.history = [];
    this.rxHistory = [];
    this.txHistory = [];
    this.corePage = 0;
    this.paused = false;
    this.interval = 1500;
    this.modal = false;
    this.closed = false;
    this.screen = blessed.screen({
      smartCSR: true,
      fullUnicode: true,
      title: "Freznel | System Monitor",
      terminal: "xterm-256color",
      ignoreLocked: ["C-c"],
      style: { bg: colors.bg },
      dockBorders: true,
      ...screenOptions,
    });
    this.screen.key(["C-c"], () => this.quit());
    this.screen.on("resize", () => {
      if (this.dashboard) this.layout();
      this.screen.render();
    });
  }
  box(options) {
    return blessed.box({
      parent: this.screen,
      border: "line",
      padding: { left: 1, right: 1 },
      style: { fg: colors.text, bg: colors.bg, border: { fg: colors.muted } },
      ...options,
    });
  }
  quit() {
    this.closed = true;
    clearTimeout(this.timer);
    this.screen.destroy();
    process.exit(0);
  }
  start(local) {
    if (local) this.showDashboard("LOCAL PREVIEW");
    else this.showAuth();
  }
  showAuth() {
    const panel = this.box({
      top: "center",
      left: "center",
      width: "90%",
      height: 22,
      label: " FREZNEL / ACCOUNT ",
    });
    blessed.text({
      parent: panel,
      top: 1,
      left: 2,
      content: "SYSTEM TASKS & SENSORS",
      style: { fg: colors.green },
    });
    blessed.text({
      parent: panel,
      top: 3,
      left: 2,
      content: "Firebase authentication | Tab to navigate",
    });
    blessed.text({ parent: panel, top: 5, left: 2, content: "Email" });
    const email = blessed.textbox({
      parent: panel,
      top: 6,
      left: 2,
      right: 2,
      height: 3,
      border: "line",
      inputOnFocus: true,
      style: {
        fg: colors.text,
        bg: "#191f27",
        focus: { border: { fg: colors.green } },
      },
    });
    blessed.text({ parent: panel, top: 9, left: 2, content: "Password" });
    const password = blessed.textbox({
      parent: panel,
      top: 10,
      left: 2,
      right: 2,
      height: 3,
      border: "line",
      censor: true,
      inputOnFocus: true,
      style: {
        fg: colors.text,
        bg: "#191f27",
        focus: { border: { fg: colors.green } },
      },
    });
    const login = blessed.button({
      parent: panel,
      top: 14,
      left: 2,
      width: 13,
      height: 3,
      border: "line",
      content: " Sign in ",
      keys: true,
      style: { focus: { bg: "#34513c" } },
    });
    const signup = blessed.button({
      parent: panel,
      top: 14,
      left: 18,
      width: 16,
      height: 3,
      border: "line",
      content: " Create account ",
      keys: true,
      style: { focus: { bg: "#34513c" } },
    });
    const status = blessed.box({
      parent: panel,
      top: 18,
      left: 2,
      right: 2,
      height: 2,
      content: this.auth.apiKey
        ? "Enter on password signs in. New user? Choose Create account."
        : "Set FIREBASE_API_KEY in .env, or use npm run preview.",
      style: { fg: colors.text, bg: "#191f27" },
    });
    const fields = [email, password, login, signup];
    fields.forEach((field) => {
      // Manage focus once; Blessed's bubbling autofocus can restart input mid-click.
      field.options.autoFocus = false;
      field.on("click", (data) => {
        if (data.button !== "left") return;
        const focused = this.screen.focused;
        if (focused !== field && focused?._reading) focused.cancel();
        field.focus();
        if (field.type === "button") field.press();
        this.screen.render();
      });
    });
    [email, password].forEach((field) => {
      const listener = field._listener.bind(field);
      field._listener = (ch, key) => {
        if (key.name !== "tab") listener(ch, key);
      };
    });
    fields.forEach((field, index) => {
      const move = (offset) => {
        if (field._reading) field.cancel();
        fields[(index + fields.length + offset) % fields.length].focus();
        this.screen.render();
      };
      field.key("tab", () => move(1));
      field.key("S-tab", () => move(-1));
    });
    email.on("submit", () => {
      password.focus();
      this.screen.render();
    });
    let busy = false;
    const submit = async (isSignup) => {
      if (busy) return;
      busy = true;
      login.setContent(isSignup ? " Sign in " : " Signing in ");
      signup.setContent(isSignup ? " Creating... " : " Create account ");
      status.style.fg = colors.blue;
      status.setContent(
        "Connecting to Firebase... Please wait (up to 15 seconds).",
      );
      this.screen.render();
      try {
        const user = await this.auth.authenticate(
          email.getValue(),
          password.getValue(),
          isSignup,
        );
        password.clearValue();
        panel.destroy();
        this.showDashboard(user.email);
      } catch (error) {
        status.style.fg = "#ff9999";
        status.setContent(
          clean(
            error.name === "TimeoutError"
              ? "Connection timed out. Try again."
              : error.message,
          ),
        );
      } finally {
        busy = false;
        if (!this.dashboard) {
          login.setContent(" Sign in ");
          signup.setContent(" Create account ");
        }
        this.screen.render();
      }
    };
    password.on("submit", () => {
      login.focus();
      submit(false);
    });
    login.on("press", () => submit(false));
    signup.on("press", () => submit(true));
    email.focus();
    this.screen.render();
  }
  showDashboard(identity) {
    this.dashboard = true;
    this.identity = identity;
    this.header = blessed.box({
      parent: this.screen,
      height: 1,
      style: { fg: colors.green, bg: colors.bg },
    });
    this.cpu = this.box({
      label: " CPU / HISTORY ",
      style: { fg: colors.green, border: { fg: colors.green }, bg: colors.bg },
    });
    this.memory = this.box({
      label: " MEMORY ",
      style: { fg: colors.green, border: { fg: colors.muted }, bg: colors.bg },
    });
    this.disks = this.box({ label: " DISKS " });
    this.network = this.box({
      label: " NETWORK ",
      style: { fg: colors.purple, border: { fg: colors.muted }, bg: colors.bg },
    });
    this.processPanel = this.box({ label: " PROCESSES " });
    this.table = blessed.list({
      parent: this.processPanel,
      top: 2,
      left: 0,
      right: 0,
      bottom: 0,
      keys: true,
      vi: true,
      mouse: true,
      tags: false,
      scrollbar: { ch: "│" },
      style: {
        fg: colors.text,
        bg: colors.bg,
        selected: { bg: "#293c35", fg: "#d9f5ca" },
      },
    });
    this.columns = blessed.text({
      parent: this.processPanel,
      top: 0,
      left: 0,
      right: 0,
      height: 1,
      style: { fg: colors.muted },
    });
    this.footer = blessed.box({
      parent: this.screen,
      bottom: 0,
      height: 2,
      wrap: false,
      style: { fg: colors.muted, bg: colors.bg },
    });
    this.small = this.box({
      top: "center",
      left: "center",
      width: "100%",
      height: 5,
      content:
        "Resize terminal to at least 60 columns x 20 rows.\nCtrl+C or q to quit.",
      hidden: true,
    });
    const bind = (keys, action) =>
      this.screen.key(keys, () => {
        if (!this.modal) {
          action();
          this.render();
        }
      });
    bind(["q"], () => this.quit());
    bind(["s"], () => this.store.cycleSort());
    bind(["r"], () => {
      this.store.reverse = !this.store.reverse;
    });
    bind(["v"], () => this.store.cycleMode());
    bind(["space"], () => {
      this.paused = !this.paused;
    });
    bind(["/"], () => this.search());
    bind(["escape"], () => {
      this.store.query = "";
    });
    bind(["enter"], () => this.details());
    bind(["?", "h"], () => this.help());
    bind(["+", "="], () => {
      this.interval = Math.min(10000, this.interval + 500);
    });
    bind(["-"], () => {
      this.interval = Math.max(500, this.interval - 500);
    });
    [this.cpu, this.memory, this.disks, this.network].forEach((panel) => {
      panel.parseTags = true;
    });
    bind(["c"], () => {
      const pages = Math.ceil(
        (this.data?.load?.cpus?.length || 1) /
          Math.max(1, this.cpu.height - 11),
      );
      this.corePage = (this.corePage + 1) % pages;
    });
    this.table.focus();
    this.layout();
    this.tick();
  }
  layout() {
    const w = this.screen.width,
      h = this.screen.height,
      narrow = w < 100;
    const topHeight = Math.max(6, Math.floor((h - 3) * 0.34));
    Object.assign(this.cpu, { top: 1, left: 0, width: w, height: topHeight });
    const y = topHeight + 1,
      remaining = h - y - 2;
    if (narrow) {
      const statHeight = Math.max(5, Math.floor(remaining * 0.38));
      [this.memory, this.disks, this.network].forEach((panel, i) =>
        Object.assign(panel, {
          top: y,
          left: Math.floor((w * i) / 3),
          width: Math.floor((w * (i + 1)) / 3) - Math.floor((w * i) / 3),
          height: statHeight,
        }),
      );
      Object.assign(this.processPanel, {
        top: y + statHeight,
        left: 0,
        width: w,
        height: remaining - statHeight,
      });
    } else {
      const leftWidth = Math.floor(w * 0.45),
        middleHeight = Math.floor(remaining * 0.6);
      Object.assign(this.memory, {
        top: y,
        left: 0,
        width: Math.floor(leftWidth / 2),
        height: middleHeight,
      });
      Object.assign(this.disks, {
        top: y,
        left: Math.floor(leftWidth / 2),
        width: leftWidth - Math.floor(leftWidth / 2),
        height: middleHeight,
      });
      Object.assign(this.network, {
        top: y + middleHeight,
        left: 0,
        width: leftWidth,
        height: remaining - middleHeight,
      });
      Object.assign(this.processPanel, {
        top: y,
        left: leftWidth,
        width: w - leftWidth,
        height: remaining,
      });
    }
    if (w < 60 || h < 20) {
      this.small.show();
      this.small.setFront();
    } else this.small.hide();
    this.render();
  }
  async tick() {
    if (this.closed) return;
    if (!this.paused) {
      try {
        this.data = await this.service.sample();
        this.store.update(this.data.processes);
        this.store.updateServices(this.data.services);
        this.history.push(this.data.load?.currentLoad ?? 0);
        if (this.history.length > 300) this.history.shift();
        for (const [key, history] of [
          ["rx_sec", this.rxHistory],
          ["tx_sec", this.txHistory],
        ]) {
          history.push(
            this.data.network.reduce(
              (sum, n) => sum + Math.max(0, n[key] || 0),
              0,
            ),
          );
          if (history.length > 300) history.shift();
        }
        this.error = "";
      } catch {
        this.error = "Sample failed; retrying";
      }
    }
    if (!this.closed) {
      this.render();
      this.timer = setTimeout(() => this.tick(), this.interval);
    }
  }
  render() {
    if (!this.dashboard) return;
    this.header.setContent(
      ` cpu  [?] menu   ${new Date().toLocaleTimeString()}   BAT ${this.data?.battery?.hasBattery ? this.data.battery.percent + "%" : "N/A"}   ${this.interval}ms   ${clean(this.identity)}`,
    );
    const d = this.data;
    if (d) {
      renderReference(this, d);
    } else this.cpu.setContent("Collecting system information...");
    const previous = this.rows?.[this.table.selected]?.pid;
    this.rows = this.store.visible();
    renderProcesses(this);
    const index = this.rows.findIndex((p) => p.pid === previous);
    if (index >= 0) this.table.select(index);
    this.processPanel.setLabel(
      ` ${this.store.mode.toUpperCase()} ${this.rows.length} / ${this.store.sort}${this.store.reverse ? " ↑" : " ↓"} / [v] view `,
    );
    const status =
      this.error ||
      (d?.errors.length
        ? `Unavailable/stale: ${d.errors.join(", ")}`
        : `LIVE | ${this.interval}ms | uptime ${Math.floor((d?.uptime ?? 0) / 3600)}h`);
    this.footer.setContent(
      ` / filter  c cores  v view  s sort  r reverse  Space pause  Enter details  ? help  q quit\n ${this.paused ? "PAUSED" : status}${this.store.query ? ` | filter: ${clean(this.store.query)}` : ""}`,
    );
    this.screen.render();
  }
  search() {
    this.modal = true;
    const prompt = blessed.prompt({
      parent: this.screen,
      top: "center",
      left: "center",
      width: "80%",
      height: 8,
      border: "line",
      label: " SEARCH / Esc cancels ",
      style: { bg: "#191f27", fg: colors.text },
    });
    prompt.input(
      "Filter by process name, PID or user:",
      this.store.query,
      (error, value) => {
        if (!error && value != null) this.store.query = value;
        prompt.destroy();
        this.modal = false;
        this.table.focus();
        this.render();
      },
    );
  }
  dialog(title, content) {
    this.modal = true;
    const box = this.box({
      top: "center",
      left: "center",
      width: "90%",
      height: "70%",
      label: ` ${title} `,
      content,
      scrollable: true,
      keys: true,
      vi: true,
    });
    box.key(["escape", "enter", "q"], () => {
      box.destroy();
      this.modal = false;
      this.table.focus();
      this.render();
    });
    box.focus();
    this.screen.render();
  }
  details() {
    const p = this.rows?.[this.table.selected];
    if (!p) return;
    this.dialog(
      "PROCESS DETAILS / Esc closes",
      `\n${clean(p.name)}\n\nPID       ${p.pid}\nParent    ${p.parentPid ?? "N/A"}\nUser      ${clean(p.user) || "N/A"}\nState     ${clean(p.state) || "N/A"}\nCPU       ${percent(p.cpu)}\nMemory    ${bytes(p.memRss * 1024)}\n\nCommand\n${clean(p.command)}\n${clean(p.params)}`,
    );
  }
  help() {
    this.dialog(
      "KEYBOARD GUIDE / Esc closes",
      "\nUp/Down, j/k   Select row\nPageUp/PageDown Scroll list\n/             Search name, PID or user\nEsc           Clear search / close dialog\nv             Process / tree / services view\nc             Page through CPU cores\ns             Cycle CPU, memory, PID, name sort\nr             Reverse sort order\nSpace         Pause/resume collection\nEnter         Inspect selected row\n+ / -         Slower / faster refresh (0.5-10s)\nq / Ctrl+C    Quit\n\nResize the terminal to rearrange panels.\nUnavailable sensors display N/A. Timed-out readings\nretain their last value and are marked stale.\nLocal preview is not an authenticated session.",
    );
  }
}
