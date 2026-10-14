import test from 'node:test';
import assert from 'node:assert/strict';
import { WindowsProcessDetails } from '../src/api/WindowsProcessDetails.js';

test('Windows process details merge thread count and owner and reuse cache', async () => {
  let calls = 0;
  const run = (_file, _args, _options, callback) => {
    calls++;
    callback(null, JSON.stringify([{ Id: 42, ThreadCount: 7, SessionId: 1 }]));
  };
  const details = new WindowsProcessDetails(run, 30_000);
  const input = [{ pid: 42, name: 'node', user: '' }, { pid: 9, name: 'system', user: '' }];
  const first = await details.enrich(input);
  const second = await details.enrich(input);
  assert.equal(first[0].threads, 7); assert.match(first[0].user, /\\/);
  assert.equal(first[1].threads, undefined); assert.equal(calls, 1);
  assert.deepEqual(second, first);
});

test('failed Windows detail query leaves process data intact', async () => {
  const details = new WindowsProcessDetails((_file, _args, _options, callback) => callback(new Error('denied'), ''));
  const items = [{ pid: 1, name: 'system' }];
  assert.deepEqual(await details.enrich(items), items);
});
