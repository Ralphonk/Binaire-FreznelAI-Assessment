import si from 'systeminformation';
import os from 'node:os';
import { WindowsProcessDetails } from './WindowsProcessDetails.js';

export class SystemService {
  constructor(provider = si, processDetails = provider === si ? new WindowsProcessDetails() : { enrich: async items => items }) {
    this.provider = provider; this.processDetails = processDetails; this.pending = new Map(); this.last = {};
  }
  async read(name, fallback, ...args) {
    // A slow OS probe is reused, so timed-out polls cannot accumulate subprocesses.
    if (!this.pending.has(name)) {
      const operation = Promise.resolve().then(() => this.provider[name](...args)).then(value => {
        this.last[name] = value;
        return value;
      }).finally(() => this.pending.delete(name));
      this.pending.set(name, operation);
    }
    let timer;
    try {
      return await Promise.race([this.pending.get(name), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), 4000);
      })]);
    } catch { this.errors.push(name); return this.last[name] ?? fallback; }
    finally { clearTimeout(timer); }
  }
  async sample() {
    this.errors = [];
    const [load, memory, disks, network, processes, temperature, battery, graphics] = await Promise.all([
      this.read('currentLoad', null), this.read('mem', null), this.read('fsSize', []),
      this.read('networkStats', []), this.read('processes', { list: [] }),
      this.read('cpuTemperature', null), this.read('battery', null),
      this.read('graphics', { controllers: [], displays: [] })
    ]);
    const enrichedProcesses = await this.processDetails.enrich(processes.list);
    const services = enrichedProcesses.filter(process => {
      const text = `${process.name} ${process.command}`.toLowerCase();
      return /svchost|services\.exe|spoolsv|lsass|wininit|system32.*service/.test(text);
    }).map(process => ({
      name: process.name, running: true, pids: [process.pid],
      startmode: 'service host', cpu: process.cpu
    }));
    return {
      load, memory, disks, network, processes: enrichedProcesses, temperature, battery,
      graphics: graphics.controllers ?? [], services,
      cpu: os.cpus()[0]?.model ?? 'CPU', uptime: os.uptime(), host: os.hostname(), errors: [...this.errors]
    };
  }
}
