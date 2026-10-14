import test from 'node:test';
import assert from 'node:assert/strict';
import { ProcessStore } from '../src/models/ProcessStore.js';
import { FirebaseAuth } from '../src/auth/FirebaseAuth.js';
import { SystemService } from '../src/api/SystemService.js';
import { bytes, clean, bar } from '../src/utils/format.js';

test('process search, sorting and reversal preserve input', () => {
  const items = [{ pid: 2, name: 'Node', user: 'rahul', cpu: 5, memRss: 90 }, { pid: 1, name: 'Shell', user: 'root', cpu: 20, memRss: 10 }];
  const store = new ProcessStore(); store.update(items);
  assert.deepEqual(store.visible().map(p => p.pid), [1, 2]);
  assert.equal(items[0].pid, 2);
  store.reverse = true; assert.equal(store.visible()[0].pid, 2);
  store.query = 'RAHUL'; assert.equal(store.visible().length, 1);
  store.query = 'absent'; assert.equal(store.visible().length, 0);
  store.query = ''; store.reverse = false; store.cycleSort(); assert.equal(store.visible()[0].pid, 2);
});
test('formatting handles unsupported values and strips terminal controls', () => {
  assert.equal(bytes(-1), 'N/A'); assert.equal(bytes(1024), '1.0 KiB');
  assert.equal(bar(200, 5), '█████'); assert.equal(clean('\x1bhello\n'), ' hello ');
});
test('Firebase sends signup payload and returns only identity', async () => {
  const auth = new FirebaseAuth('test-key', async (url, options) => {
    assert.match(url, /accounts:signUp/); assert.equal(JSON.parse(options.body).email, 'a@b.com');
    return { ok: true, json: async () => ({ email: 'a@b.com', localId: 'uid', idToken: 'secret' }) };
  });
  assert.deepEqual(await auth.authenticate(' a@b.com ', 'password', true), { email: 'a@b.com', uid: 'uid' });
});
test('Firebase errors and missing configuration are actionable', async () => {
  await assert.rejects(new FirebaseAuth('').authenticate('a', 'b'), /FIREBASE_API_KEY/);
  const auth = new FirebaseAuth('key', async () => ({ ok: false, json: async () => ({ error: { message: 'INVALID_LOGIN_CREDENTIALS' } }) }));
  await assert.rejects(auth.authenticate('a@b.com', 'wrong'), /incorrect/);
});
test('partial probe failure preserves other system readings and last good value', async () => {
  const provider = {
    currentLoad: async () => ({ currentLoad: 42 }), mem: async () => ({ total: 100 }),
    fsSize: async () => [], networkStats: async () => [], processes: async () => ({ list: [{ pid: 1 }] }),
    cpuTemperature: async () => { throw new Error('unsupported'); }, battery: async () => ({ hasBattery: false }),
    graphics: async () => ({ controllers: [] }), services: async () => []
  };
  const service = new SystemService(provider);
  const first = await service.sample(); assert.equal(first.load.currentLoad, 42); assert.equal(first.processes.length, 1);
  assert.deepEqual(first.errors, ['cpuTemperature']);
  provider.currentLoad = async () => { throw new Error('failed'); };
  const second = await service.sample(); assert.equal(second.load.currentLoad, 42); assert.ok(second.errors.includes('currentLoad'));
});
