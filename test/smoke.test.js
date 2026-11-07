const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

const calls = [];
let wsInstance = null;

class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1;
    this.sent = [];
    wsInstance = this;
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
}

globalThis.WebSocket = FakeWebSocket;

globalThis.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  calls.push({ url, params: body.params });
  const cmd = body.params[1] && body.params[1][0];
  if (cmd === 'players') {
    return {
      ok: true,
      json: async () => ({
        result: {
          players: [
            { playerid: 'aa:bb:cc:dd:ee:ff', name: 'Squeezebox Radio' },
            { playerid: '11:22:33:44:55:66', name: 'Squeezebox Touch' },
          ],
        },
      }),
    };
  }
  if (cmd === 'mixer' && body.params[1][2] === undefined) {
    return { ok: true, json: async () => ({ result: { volume: '42' } }) };
  }
  if (cmd === 'status') {
    return {
      ok: true,
      json: async () => ({
        result: { mode: 'play', playlist_loop: [{ title: 'Ma chanson', artist: 'Mon artiste' }] },
      }),
    };
  }
  return { ok: true, json: async () => ({ result: {} }) };
};

process.argv = [
  'node', 'app.js',
  '-port', '1234',
  '-pluginUUID', 'test-uuid',
  '-registerEvent', 'registerPlugin',
  '-info', '{}',
];

require(path.join(__dirname, '..', 'com.lyrion.lms.sdPlugin', 'app.js'));

function keyDown(action, context) {
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'keyDown',
      action,
      context: context || 'ctx-' + action,
      payload: {},
    }),
  });
}

async function flush() {
  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

test('plugin registers and each action sends the expected LMS command', async () => {
  wsInstance.onopen();
  assert.strictEqual(wsInstance.sent[0].event, 'registerPlugin');
  assert.strictEqual(wsInstance.sent[1].event, 'getGlobalSettings');

  keyDown('com.lyrion.lms.playpause');
  await flush();
  keyDown('com.lyrion.lms.stop');
  keyDown('com.lyrion.lms.next');
  keyDown('com.lyrion.lms.previous');
  keyDown('com.lyrion.lms.volumeup');
  keyDown('com.lyrion.lms.volumedown');
  await flush();

  const cmds = calls.map((c) => c.params[1]);
  assert.ok(cmds.some((c) => c[0] === 'players'), 'player resolution');
  assert.ok(cmds.some((c) => c[0] === 'status'), 'play/pause status query');
  assert.ok(cmds.some((c) => c[0] === 'pause'), 'play/pause toggles to pause when playing');
  assert.ok(cmds.some((c) => c[0] === 'stop'), 'stop');
  assert.ok(cmds.some((c) => c[0] === 'playlist' && c[1] === 'index' && c[2] === '+1'), 'next');
  assert.ok(cmds.some((c) => c[0] === 'playlist' && c[1] === 'index' && c[2] === '-1'), 'previous');
  assert.ok(cmds.some((c) => c[0] === 'mixer' && c[1] === 'volume' && c[2] === '+5'), 'volume up');
  assert.ok(cmds.some((c) => c[0] === 'mixer' && c[1] === 'volume' && c[2] === '-5'), 'volume down');

  assert.ok(calls.every((c) => c.url === 'http://127.0.0.1:9000/jsonrpc.js'), 'JSON-RPC endpoint');
  const playerCalls = calls.filter((c) => c.params[1] && c.params[1][0] !== 'players');
  assert.ok(playerCalls.length > 0, 'player commands sent');
  assert.ok(playerCalls.every((c) => c.params[0] === 'aa:bb:cc:dd:ee:ff'), 'target player MAC');
});

test('playmedia requires a configured media name and sends playlist play', async () => {
  const before = calls.length;
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'didReceiveSettings',
      context: 'ctx-media',
      payload: { settings: { media: 'Ma playlist rock' } },
    }),
  });
  keyDown('com.lyrion.lms.playmedia', 'ctx-media');
  await flush();
  const mediaCalls = calls.slice(before).map((c) => c.params[1]);
  assert.ok(
    mediaCalls.some((c) => c[0] === 'playlist' && c[1] === 'play' && c[2] === 'Ma playlist rock'),
    'playlist play with configured media name'
  );
});

test('nowplaying action displays the current track title on the key', async () => {
  const context = 'ctx-nowplaying';
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'willAppear',
      action: 'com.lyrion.lms.nowplaying',
      context,
      payload: { settings: {} },
    }),
  });
  await flush();
  const titleMsg = wsInstance.sent.find((m) => m.event === 'setTitle' && m.context === context);
  assert.ok(titleMsg, 'setTitle sent for nowplaying key');
  assert.strictEqual(titleMsg.payload.title, 'Mon artiste - Ma chanson');
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'willDisappear',
      action: 'com.lyrion.lms.nowplaying',
      context,
      payload: {},
    }),
  });
});

test('per-key player override targets the configured player', async () => {
  const context = 'ctx-override';
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'didReceiveSettings',
      context,
      payload: { settings: { player: '11:22:33:44:55:66' } },
    }),
  });
  const before = calls.length;
  keyDown('com.lyrion.lms.next', context);
  await flush();
  const overrideCalls = calls.slice(before).filter((c) => c.params[1] && c.params[1][0] !== 'players');
  assert.ok(overrideCalls.length > 0, 'command sent');
  assert.ok(
    overrideCalls.every((c) => c.params[0] === '11:22:33:44:55:66'),
    'per-key override MAC used'
  );
});

test('player action cycles through LMS players and shows the current one', async () => {
  const context = 'ctx-player';
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'willAppear',
      action: 'com.lyrion.lms.player',
      context,
      payload: { settings: {} },
    }),
  });
  await flush();
  const titleOnAppear = wsInstance.sent.find((m) => m.event === 'setTitle' && m.context === context);
  assert.ok(titleOnAppear, 'player name shown on appear');
  assert.strictEqual(titleOnAppear.payload.title, 'Squeezebox Radio');

  keyDown('com.lyrion.lms.player', context);
  await flush();
  const saved = wsInstance.sent.find((m) => m.event === 'setGlobalSettings');
  assert.ok(saved, 'player choice persisted globally');
  assert.strictEqual(saved.payload.player, '11:22:33:44:55:66');
  const titleAfter = wsInstance.sent.filter((m) => m.event === 'setTitle' && m.context === context).pop();
  assert.strictEqual(titleAfter.payload.title, 'Squeezebox Touch');
});

test('setvolume action applies the configured level and displays current volume', async () => {
  const context = 'ctx-volume';
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'didReceiveSettings',
      context,
      payload: { settings: { volume: 30 } },
    }),
  });
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'willAppear',
      action: 'com.lyrion.lms.setvolume',
      context,
      payload: { settings: { volume: 30 } },
    }),
  });
  await flush();
  const titleOnAppear = wsInstance.sent.find((m) => m.event === 'setTitle' && m.context === context);
  assert.ok(titleOnAppear, 'volume shown on appear');
  assert.strictEqual(titleOnAppear.payload.title, '42%');

  const before = calls.length;
  keyDown('com.lyrion.lms.setvolume', context);
  await flush();
  const setCalls = calls.slice(before).map((c) => c.params[1]);
  assert.ok(
    setCalls.some((c) => c[0] === 'mixer' && c[1] === 'volume' && c[2] === 30),
    'absolute volume level sent'
  );
  wsInstance.onmessage({
    data: JSON.stringify({
      event: 'willDisappear',
      action: 'com.lyrion.lms.setvolume',
      context,
      payload: {},
    }),
  });
});
