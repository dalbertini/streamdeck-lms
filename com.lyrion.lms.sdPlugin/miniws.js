const net = require('net');
const crypto = require('crypto');

class MiniWebSocket {
  constructor(url) {
    this.readyState = 0;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.onclose = null;
    this._buffer = Buffer.alloc(0);
    this._frag = null;
    this._handshaken = false;
    const m = /^ws:\/\/([^:/]+)(?::(\d+))?(\/.*)?$/.exec(url);
    if (!m) {
      throw new Error('URL WebSocket invalide : ' + url);
    }
    const host = m[1];
    const port = parseInt(m[2] || '80', 10);
    const path = m[3] || '/';
    const key = crypto.randomBytes(16).toString('base64');
    this._socket = net.connect(port, host, () => {
      this._socket.write(
        `GET ${path} HTTP/1.1\r\nHost: ${host}:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`
      );
    });
    this._socket.on('data', (d) => this._onData(d));
    this._socket.on('error', (e) => {
      if (this.onerror) this.onerror(e);
    });
    this._socket.on('close', () => {
      this.readyState = 3;
      if (this.onclose) this.onclose();
    });
  }

  _onData(d) {
    this._buffer = Buffer.concat([this._buffer, d]);
    if (!this._handshaken) {
      const idx = this._buffer.indexOf('\r\n\r\n');
      if (idx === -1) return;
      const head = this._buffer.slice(0, idx).toString('utf8');
      this._buffer = this._buffer.slice(idx + 4);
      if (!/^HTTP\/1\.1 101/.test(head)) {
        if (this.onerror) this.onerror(new Error('Handshake WebSocket refusé : ' + head.split('\r\n')[0]));
        return;
      }
      this._handshaken = true;
      this.readyState = 1;
      if (this.onopen) this.onopen();
    }
    this._parseFrames();
  }

  _parseFrames() {
    for (;;) {
      const b = this._buffer;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        len = Number(b.readBigUInt64BE(2));
        off = 10;
      }
      let maskKey = null;
      if (masked) {
        if (b.length < off + 4) return;
        maskKey = b.slice(off, off + 4);
        off += 4;
      }
      if (b.length < off + len) return;
      let payload = b.slice(off, off + len);
      if (maskKey) {
        const out = Buffer.alloc(len);
        for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i % 4];
        payload = out;
      }
      this._buffer = b.slice(off + len);
      if (opcode === 0x8) {
        this.readyState = 3;
        this._socket.end();
        if (this.onclose) this.onclose();
        return;
      }
      if (opcode === 0x9) {
        this._sendFrame(0xA, payload);
        continue;
      }
      if (opcode === 0x0 && this._frag) {
        this._frag = Buffer.concat([this._frag, payload]);
        if (fin) {
          const msg = this._frag;
          this._frag = null;
          this._emit(msg);
        }
        continue;
      }
      if (opcode === 0x1 || opcode === 0x2) {
        if (fin) {
          this._emit(payload);
        } else {
          this._frag = payload;
        }
      }
    }
  }

  _emit(payload) {
    if (this.onmessage) this.onmessage({ data: payload.toString('utf8') });
  }

  _sendFrame(opcode, payload) {
    const mask = crypto.randomBytes(4);
    let header;
    if (payload.length < 126) {
      header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    } else if (payload.length < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 126;
      header.writeUInt16BE(payload.length, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 0x80 | 127;
      header.writeBigUInt64BE(BigInt(payload.length), 2);
    }
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    this._socket.write(Buffer.concat([header, mask, masked]));
  }

  send(str) {
    if (this.readyState !== 1) return;
    this._sendFrame(0x1, Buffer.from(str, 'utf8'));
  }

  close() {
    if (this.readyState === 1) this._sendFrame(0x8, Buffer.alloc(0));
    this._socket.end();
  }
}

module.exports = MiniWebSocket;
