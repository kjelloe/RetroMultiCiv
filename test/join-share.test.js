// join-share: the lobby invite link + QR. inviteUrl is pure (unit-tested with a
// location polyfill); the QR encoder (vendored qrcode-generator) is exercised to
// confirm it encodes the invite URL to a valid module matrix. The canvas render
// itself is DOM (covered by the waiting-room screenshot).
const test = require('node:test');
const assert = require('node:assert');

test('inviteUrl builds the ?join= deep link on the current origin', async () => {
  global.location = { origin: 'http://192.168.1.9:8123', search: '' };
  global.localStorage = global.localStorage || { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const { inviteUrl } = await import('../client/ui/lobby.js');
  assert.strictEqual(inviteUrl('RTFZ7'), 'http://192.168.1.9:8123/client/?join=RTFZ7');
  // a lowercase code is encoded verbatim (the setup.js ?join= handler uppercases)
  assert.match(inviteUrl('ab cd'), /\?join=ab%20cd$/);
});

test('the vendored QR encoder encodes the invite URL to a valid matrix', async () => {
  const { default: qrcode } = await import('../client/vendor/qrcode.min.js');
  const qr = qrcode(0, 'M');
  qr.addData('http://192.168.1.9:8123/client/?join=RTFZ7');
  qr.make();
  const n = qr.getModuleCount();
  assert.ok(n >= 21, 'a QR is at least 21×21 modules');
  // the top-left finder pattern: a solid dark 7×7 with a light ring — spot-check
  assert.strictEqual(qr.isDark(0, 0), true);
  assert.strictEqual(qr.isDark(1, 1), false); // inside the finder's light ring
  assert.strictEqual(qr.isDark(3, 3), true);  // finder centre
});
