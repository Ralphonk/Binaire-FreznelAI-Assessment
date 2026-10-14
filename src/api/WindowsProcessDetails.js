import { execFile } from 'node:child_process';
import process from 'node:process';
import os from 'node:os';

const threadScript = String.raw`Get-CimInstance Win32_Process | Select-Object @{N='Id';E={[int]$_.ProcessId}},@{N='ThreadCount';E={[int]$_.ThreadCount}},@{N='SessionId';E={[int]$_.SessionId}} | ConvertTo-Json -Compress`;
const parseRows = stdout => {
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
};

export class WindowsProcessDetails {
  constructor(run = execFile, ttl = 30_000) {
    this.run = run; this.ttl = ttl; this.cache = new Map(); this.updatedAt = 0;
    this.pending = null;
  }
  execute(script, timeout) {
    return new Promise(resolve => this.run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
      { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout) => resolve(!error && stdout.trim() ? stdout : '')));
  }
  async refresh() {
    if (process.platform !== 'win32') return;
    if (this.pending) return this.pending;
    this.pending = this.execute(threadScript, 5_000).then(stdout => {
      if (!stdout) return;
      try {
        for (const row of parseRows(stdout)) {
          const current = this.cache.get(Number(row.Id)) ?? {};
          const session = Number(row.SessionId);
          const user = session > 0 ? `${process.env.USERDOMAIN || os.hostname()}\\${os.userInfo().username}`
            : Number(row.Id) <= 4 ? 'NT AUTHORITY\\SYSTEM' : 'NT AUTHORITY\\SERVICE';
          this.cache.set(Number(row.Id), { ...current, threads: Number(row.ThreadCount) || 0, user });
        }
        this.updatedAt = Date.now();
      } catch { }
    }).finally(() => { this.pending = null; });
    return this.pending;
  }
  async enrich(items) {
    if (process.platform !== 'win32') return items;
    if (Date.now() - this.updatedAt >= this.ttl) await this.refresh();
    return items.map(item => {
      const details = this.cache.get(Number(item.pid));
      return details ? { ...item, threads: details.threads, user: details.user || item.user } : item;
    });
  }
}
