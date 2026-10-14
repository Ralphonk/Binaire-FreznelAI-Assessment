import test from 'node:test';
import assert from 'node:assert/strict';
import { historyGraph, processColumns } from '../src/components/ReferenceView.js';

test('history uses bounded cells and right-aligns only actual samples', () => {
  const graph = historyGraph([50, 100], 10, 4).replace(/\{[^}]+\}/g, '').split('\n');
  assert.equal(graph.length, 4);
  for (const line of graph) { assert.equal([...line].length, 10); assert.ok(line.startsWith('        ')); }
  assert.ok(graph[0].endsWith('█'));
});
test('process columns fit terminal widths and expose details when space permits', () => {
  for (const width of [40, 60, 74, 75, 90, 120]) {
    const columns = processColumns(width);
    assert.ok(columns.reduce((sum, c) => sum + c[2], 0) + columns.length - 1 <= width);
    if (width >= 60) for (const key of ['command', 'threads', 'user']) assert.ok(columns.some(c => c[0] === key));
  }
});
test('process store exposes tree and services views', async () => {
  const { ProcessStore } = await import('../src/models/ProcessStore.js');
  const store = new ProcessStore();
  store.update([{ pid: 2, parentPid: 1, name: 'child', cpu: 1, memRss: 1 }]);
  store.mode = 'tree'; assert.match(store.visible()[0].displayName, /child/);
  store.updateServices([{ name: 'Updater', running: true, pids: [44], startmode: 'auto' }]);
  store.mode = 'services';
  assert.equal(store.visible()[0].pid, 44); assert.equal(store.visible()[0].state, 'running');
});
