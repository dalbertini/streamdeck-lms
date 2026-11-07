let WebSocketImpl = globalThis.WebSocket;
if (!WebSocketImpl) {
  try {
    WebSocketImpl = require('ws');
  } catch (e) {
    WebSocketImpl = null;
  }
}

const state = {
  ws: null,
  globalSettings: { host: '127.0.0.1', port: 9000, player: '' },
  settings: {},
  playerMac: null,
};

const NOW_PLAYING_ACTION = 'com.lyrion.lms.nowplaying';
const nowPlayingTimers = {};

function send(event, payload) {
  if (state.ws && state.ws.readyState === 1) {
    state.ws.send(JSON.stringify(Object.assign({ event }, payload)));
  }
}

function showAlert(context) {
  send('showAlert', { context });
}

async function lmsRequest(params) {
  const host = state.globalSettings.host || '127.0.0.1';
  const port = state.globalSettings.port || 9000;
  const res = await fetch(`http://${host}:${port}/jsonrpc.js`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, method: 'slim.request', params }),
  });
  if (!res.ok) {
    throw new Error(`LMS : erreur HTTP ${res.status} (${host}:${port})`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`LMS : ${json.error.message || 'erreur inconnue'}`);
  }
  return json;
}

async function resolvePlayer() {
  if (state.globalSettings.player) {
    return state.globalSettings.player;
  }
  if (state.playerMac) {
    return state.playerMac;
  }
  const r = await lmsRequest(['', ['players', 0, 20]]);
  const players = (r.result && r.result.players) || [];
  if (!players.length) {
    throw new Error('Aucun lecteur trouvé sur le serveur LMS');
  }
  state.playerMac = players[0].playerid;
  return state.playerMac;
}

async function sendCommand(cmd) {
  const player = await resolvePlayer();
  return lmsRequest([player, cmd]);
}

async function togglePlayPause() {
  const player = await resolvePlayer();
  const r = await lmsRequest([player, ['status', '-', 1, '']]);
  const mode = r.result && r.result.mode;
  return lmsRequest([player, mode === 'play' ? ['pause'] : ['play']]);
}

async function updateNowPlaying(context) {
  try {
    const player = await resolvePlayer();
    const r = await lmsRequest([player, ['status', '-', 1, 'tags:tal']]);
    const result = r.result || {};
    const track = (result.playlist_loop && result.playlist_loop[0]) || {};
    let title;
    if (result.mode === 'stop' || !track.title) {
      title = 'Arrêt';
    } else {
      title = track.artist ? `${track.artist} - ${track.title}` : track.title;
    }
    send('setTitle', { context, payload: { title, target: 0 } });
  } catch (err) {
    send('setTitle', { context, payload: { title: 'LMS hors ligne', target: 0 } });
  }
}

function startNowPlaying(context) {
  if (nowPlayingTimers[context]) {
    return;
  }
  updateNowPlaying(context);
  nowPlayingTimers[context] = setInterval(() => updateNowPlaying(context), 5000);
}

function stopNowPlaying(context) {
  if (nowPlayingTimers[context]) {
    clearInterval(nowPlayingTimers[context]);
    delete nowPlayingTimers[context];
  }
}

const actions = {
  'com.lyrion.lms.playpause': () => togglePlayPause(),
  'com.lyrion.lms.stop': () => sendCommand(['stop']),
  'com.lyrion.lms.next': () => sendCommand(['playlist', 'index', '+1']),
  'com.lyrion.lms.previous': () => sendCommand(['playlist', 'index', '-1']),
  'com.lyrion.lms.volumeup': () => sendCommand(['mixer', 'volume', '+5']),
  'com.lyrion.lms.volumedown': () => sendCommand(['mixer', 'volume', '-5']),
  'com.lyrion.lms.nowplaying': (context) => updateNowPlaying(context),
  'com.lyrion.lms.playmedia': async (context) => {
    const media = state.settings[context] && state.settings[context].media;
    if (!media) {
      throw new Error('Nom du média non configuré dans les réglages de la touche');
    }
    return sendCommand(['playlist', 'play', media]);
  },
};

function handleEvent(data) {
  const { event, context, payload, action } = data;
  switch (event) {
    case 'getGlobalSettings':
    case 'didReceiveGlobalSettings':
      if (payload && payload.settings) {
        state.globalSettings = Object.assign({}, state.globalSettings, payload.settings);
      }
      break;
    case 'setGlobalSettings':
      state.globalSettings = Object.assign({}, state.globalSettings, payload.settings || {});
      state.playerMac = null;
      break;
    case 'willAppear':
      if (payload && payload.settings) {
        state.settings[context] = payload.settings;
      }
      if (action === NOW_PLAYING_ACTION) {
        startNowPlaying(context);
      }
      break;
    case 'willDisappear':
      if (action === NOW_PLAYING_ACTION) {
        stopNowPlaying(context);
      }
      break;
    case 'didReceiveSettings':
      if (payload && payload.settings) {
        state.settings[context] = payload.settings;
      }
      break;
    case 'keyDown': {
      const fn = actions[action];
      if (!fn) {
        break;
      }
      Promise.resolve(fn(context)).catch((err) => {
        console.error(err.message);
        showAlert(context);
      });
      break;
    }
    default:
      break;
  }
}

function getArg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function connect() {
  if (!WebSocketImpl) {
    console.error('WebSocket indisponible : installez le module "ws" dans le dossier du plugin (npm i ws)');
    process.exit(1);
  }
  const port = getArg('-port');
  const uuid = getArg('-pluginUUID');
  const registerEvent = getArg('-registerEvent');
  const ws = new WebSocketImpl(`ws://127.0.0.1:${port}`);
  state.ws = ws;
  ws.onopen = () => {
    ws.send(JSON.stringify({ event: registerEvent, uuid }));
    send('getGlobalSettings', { context: uuid });
  };
  ws.onmessage = (msg) => {
    const raw = msg.data !== undefined ? msg.data : msg;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return;
    }
    handleEvent(data);
  };
  ws.onerror = (err) => {
    console.error('WebSocket :', err.message || err);
  };
  ws.onclose = () => {
    process.exit(0);
  };
}

connect();
