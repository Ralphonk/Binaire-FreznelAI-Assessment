import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { TerminalApp } from '../src/components/TerminalApp.js';

function createApp(width = 120, height = 35) {
  const input = new PassThrough(); input.isTTY = true; input.setRawMode = () => {};
  const output = new PassThrough(); output.isTTY = true; output.columns = width; output.rows = height;
  output.on('data', () => {});
  const app = new TerminalApp({ input, output, terminal: 'xterm-256color' });
  app.tick = () => {};
  return { app, input, output };
}
for (const fromPassword of [true, false]) {
  test(`Enter signs in from ${fromPassword ? 'password' : 'button'} and opens dashboard`, async () => {
    const { app, input } = createApp();
    const settle = () => new Promise(resolve => setImmediate(resolve));
    try {
      app.showAuth(); await settle();
      input.write('rahul@example.com'); await settle();
      input.write('\t'); await settle();
      input.write('test-password'); await settle();
      if (!fromPassword) { input.write('\t'); await settle(); }
      let calls = 0;
      app.auth.authenticate = async (email, password, signup) => {
        calls++;
        assert.equal(email, 'rahul@example.com'); assert.equal(password, 'test-password');
        assert.equal(signup, false); return { email, uid: 'test' };
      };
      input.write('\r'); await settle();
      assert.equal(calls, 1); assert.equal(app.dashboard, true);
      assert.equal(app.identity, 'rahul@example.com');
    } finally { app.screen.destroy(); }
  });
}
test('dashboard renders data and rearranges at smaller terminal widths', () => {
  const { app, output } = createApp();
  try {
    app.showDashboard('LOCAL PREVIEW');
    app.data = { cpu: 'Test CPU', load: { currentLoad: 50, cpus: [{ load: 50 }] },
      memory: { total: 1024, active: 512, available: 512, swapused: 0, swaptotal: 0 },
      disks: [], network: [], graphics: [], services: [], errors: [], uptime: 60 };
    app.store.update([{ pid: 42, name: 'node', cpu: 10, memRss: 1024 }]);
    app.render();
    assert.match(app.cpu.content, /Test CPU/); assert.match(app.table.items[0].content, /node/);
    assert.ok(app.processPanel.left > 0);
    output.columns = 80; app.screen.program.cols = 80; app.layout();
    assert.equal(app.processPanel.left, 0);
    assert.ok(app.processPanel.top > app.memory.top);
    app.details(); assert.equal(app.modal, true);
    app.screen.focused.emit('key escape', '', { name: 'escape', full: 'escape' });
    assert.equal(app.modal, false);
  } finally { app.screen.destroy(); }
});
test('auth Tab moves focus without adding whitespace to credentials', async () => {
  const { app, input } = createApp();
  try {
    app.showAuth(); await new Promise(resolve => setImmediate(resolve));
    const email = app.screen.focused;
    email.setValue('rahul@example.com');
    input.write('\t'); await new Promise(resolve => setImmediate(resolve));
    assert.notEqual(app.screen.focused, email);
    assert.equal(app.screen.focused.censor, true);
    assert.equal(email.getValue(), 'rahul@example.com');
    input.write('\t'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.screen.focused.type, 'button');
  } finally { app.screen.destroy(); }
});
test('mouse selects masked password and activates sign-in with entered credentials', async () => {
  const { app, input } = createApp();
  try {
    app.showAuth(); await new Promise(resolve => setImmediate(resolve));
    const email = app.screen.focused;
    const password = email.parent.children.find(field => field.censor);
    const login = email.parent.children.find(field => field.type === 'button');
    email.setValue('rahul@example.com');
    const click = field => {
      const x = field.lpos.xi + 2, y = field.lpos.yi + 1;
      app.screen.program.emit('mouse', { action: 'mousedown', button: 'left', x, y });
      app.screen.program.emit('mouse', { action: 'mouseup', button: 'left', x, y });
    };
    click(password); await new Promise(resolve => setImmediate(resolve));
    assert.equal(app.screen.focused, password);
    input.write('test-password'); await new Promise(resolve => setImmediate(resolve));
    assert.equal(password.getValue(), 'test-password');
    assert.equal(email.getValue(), 'rahul@example.com');
    assert.ok(!password.content.includes('test-password'));
    let credentials;
    app.auth.authenticate = async (...args) => { credentials = args; throw new Error('test response'); };
    click(login); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(credentials, ['rahul@example.com', 'test-password', false]);
  } finally { app.screen.destroy(); }
});
