import { bytes, clean, percent, bar } from '../utils/format.js';

const safe = value => clean(value).replace(/[{}]/g, '');
const paint = (color, text) => `{${color}-fg}${text}{/${color}-fg}`;
const cell = (value, width) => clean(value ?? 'N/A').slice(0, width).padEnd(width);

export function historyGraph(values, width, height, palette = ['#92ba87', '#c2ae6c', '#cb826d']) {
  width = Math.max(1, width); height = Math.max(1, height);
  const samples = values.slice(-width);
  const padded = [...Array(Math.max(0, width - samples.length)).fill(null), ...samples];
  return Array.from({ length: height }, (_, row) => {
    const color = palette[Math.min(palette.length - 1, Math.floor((height - row - 1) / height * palette.length))];
    return paint(color, padded.map(value => {
      if (value === null) return ' ';
      const level = Math.max(0, Math.min(100, value)) / 100 * height - (height - row - 1);
      return level >= 1 ? '█' : level >= .5 ? '▄' : level > 0 ? '⣀' : ' ';
    }).join(''));
  }).join('\n');
}

export function processColumns(width) {
  if (width >= 75) {
    const extra = width - 75;
    return [['pid', 'Pid:', 6], ['name', 'Program:', 14 + Math.floor(extra * .3)],
    ['command', 'Command:', 15 + Math.ceil(extra * .7)], ['threads', 'Threads:', 7],
    ['user', 'User:', 9], ['memory', 'MemB', 10], ['cpuText', 'Cpu%', 8]];
  }
  if (width >= 60) return [['pid', 'Pid:', 6], ['name', 'Program:', 10],
  ['command', 'Command:', width - 46], ['threads', 'Thr', 3], ['user', 'User:', 6],
  ['memory', 'MemB', 8], ['cpuText', 'Cpu%', 7]];
  return [['pid', 'Pid:', 6], ['name', 'Program:', Math.max(8, width - 28)], ['memory', 'MemB', 10], ['cpuText', 'Cpu%', 8]];
}

export function renderReference(app, d) {
  const cpuWidth = Math.max(1, app.cpu.width - 4);
  const meterWidth = Math.min(32, Math.max(23, Math.floor(cpuWidth * .25)));
  const chartWidth = Math.max(1, cpuWidth - meterWidth - 2);
  const height = Math.max(1, app.cpu.height - 4);
  const graph = historyGraph(app.history, chartWidth, height).split('\n');
  const cores = d.load?.cpus ?? [];
  const gpu = d.graphics?.[0];
  const coreSlots = Math.max(1, height - 7);
  const offset = app.corePage * coreSlots;
  const meter = [`${safe(d.cpu).slice(0, meterWidth)}`,
  `CPU ${paint('#92ba87', bar(d.load?.currentLoad, 8))} ${percent(d.load?.currentLoad)}`,
  ...cores.slice(offset, offset + coreSlots).map((c, i) =>
    `${cell('C' + (offset + i), 3)} ${paint('#c2ae6c', bar(c.load, 8))} ${percent(c.load)} ${d.temperature?.cores?.[offset + i] > 0 ? d.temperature.cores[offset + i] + '°' : ''}`),
  `GPU ${gpu ? safe(gpu.model).slice(0, Math.max(4, meterWidth - 4)) : 'N/A'}`,
    `GPU Load ${gpu?.utilizationGpu >= 0 ? percent(gpu.utilizationGpu) : 'N/A'}  GPU Temp ${gpu?.temperatureGpu > 0 ? gpu.temperatureGpu + '°C' : 'N/A'}`,
  `VRAM ${gpu?.memoryUsed >= 0 ? gpu.memoryUsed + ' / ' + gpu.memoryTotal + ' MiB' : 'N/A'}`,
    `CPU Temp ${d.temperature?.main > 0 ? d.temperature.main + '°C' : 'N/A'}  [c] cores`];
  app.cpu.setContent(graph.map((line, i) => line + ' │' + (meter[i] ?? '')).join('\n') +
    `\nup ${Math.floor(d.uptime / 3600)}h ${Math.floor(d.uptime % 3600 / 60)}m   ${paint('#7e8b9a', 'CPU history / live samples')}`);
  const m = d.memory;
  const memWidth = Math.max(4, app.memory.width - 5);
  const metric = (label, value) => `${label.padEnd(6)}${bytes(value).padStart(Math.max(8, memWidth - 6))}`;
  app.memory.setContent(m ? [metric('Total:', m.total), metric('Used:', m.active),
  paint('#92ba87', bar(m.active / m.total * 100, memWidth)), metric('Avail:', m.available),
  metric('Cache:', m.cached), paint('#c2ae6c', bar((m.cached || 0) / m.total * 100, memWidth)), '',
  metric('Swap:', m.swaptotal), metric('Used:', m.swapused), paint('#ac89c5', bar(m.swaptotal ? m.swapused / m.swaptotal * 100 : 0, memWidth))].join('\n') : 'Memory unavailable');
  app.disks.setContent(d.disks.length ? d.disks.map(f => [safe(f.mount || f.fs),
  `Size: ${bytes(f.size)}`, `Free: ${bytes(f.available)}`,
  paint('#92ba87', bar(100 - f.use, Math.max(4, app.disks.width - 5))),
  `Used: ${percent(f.use)}`, paint('#cb826d', bar(f.use, Math.max(4, app.disks.width - 5)))].join('\n')).join('\n\n') : 'Disks unavailable');
  const netWidth = Math.max(1, app.network.width - 4);
  const traffic = d.network.filter(n => n.operstate !== 'down');
  const sum = key => traffic.reduce((total, n) => total + Math.max(0, n[key] || 0), 0);
  const info = [safe(traffic.map(n => n.iface).join(', ')), '▼ download', `${bytes(sum('rx_sec'))}/s`,
  `Total: ${bytes(sum('rx_bytes'))}`, '▲ upload', `${bytes(sum('tx_sec'))}/s`, `Total: ${bytes(sum('tx_bytes'))}`];
  if (netWidth >= 35) {
    const chartW = Math.max(1, netWidth - 23), chartH = Math.max(2, app.network.height - 2);
    const half = Math.max(1, Math.floor(chartH / 2));
    const scale = Math.max(1024, ...app.rxHistory, ...app.txHistory);
    const down = historyGraph(app.rxHistory.map(v => v / scale * 100), chartW, half, ['#8c83ca', '#657cbc', '#a198de']).split('\n');
    const up = historyGraph(app.txHistory.map(v => v / scale * 100), chartW, chartH - half, ['#a265ac', '#775188', '#b385c4']).split('\n').reverse();
    app.network.setContent([...down, ...up].map((line, i) => line + ' │ ' + (info[i] ?? '')).join('\n'));
  } else app.network.setContent(info.join('\n'));
}

export function renderProcesses(app) {
  const columns = processColumns(Math.max(30, app.processPanel.width - 4));
  app.columns.setContent(columns.map(([, label, width]) => cell(label, width)).join(' '));
  app.table.setItems(app.rows.map(p => {
    const values = { ...p, name: p.displayName || p.name, memory: bytes(p.memRss * 1024), cpuText: percent(p.cpu), command: p.command || p.name };
    return columns.map(([key, , width]) => cell(values[key], width)).join(' ');
  }));
}
