/**
 * sseClient.js
 * Manages EventSource lifecycle: connect, disconnect, error recovery.
 * Emits parsed events and connection-state changes via callbacks.
 */

export const SSE_STATE = {
  IDLE:         "idle",
  CONNECTING:   "connecting",
  CONNECTED:    "connected",
  ERROR:        "error",
  DISCONNECTED: "disconnected",
};

export class SSEClient {
  constructor({ url, onEvent, onStateChange, onParseError }) {
    this.url           = url;
    this.onEvent       = onEvent;
    this.onStateChange = onStateChange;
    this.onParseError  = onParseError;
    this._es           = null;
    this._state        = SSE_STATE.IDLE;
  }

  get state() { return this._state; }

  _setState(s) {
    this._state = s;
    this.onStateChange?.(s);
  }

  connect(url) {
    if (url) this.url = url;
    this.disconnect();
    this._setState(SSE_STATE.CONNECTING);

    try {
      this._es = new EventSource(this.url);
    } catch (err) {
      this._setState(SSE_STATE.ERROR);
      this.onParseError?.(`Failed to open stream: ${err.message}`);
      return;
    }

    this._es.onopen = () => {
      this._setState(SSE_STATE.CONNECTED);
    };

    this._es.onmessage = (e) => {
      // Ensure we are connected once first message arrives
      if (this._state !== SSE_STATE.CONNECTED) {
        this._setState(SSE_STATE.CONNECTED);
      }
      let parsed;
      try {
        parsed = JSON.parse(e.data);
      } catch {
        this.onParseError?.(`Malformed JSON: ${e.data}`);
        return;
      }
      this.onEvent?.(parsed);
    };

    this._es.onerror = () => {
      // Browser will auto-retry; we just reflect the state
      this._setState(SSE_STATE.ERROR);
    };
  }

  disconnect() {
    if (this._es) {
      this._es.close();
      this._es = null;
    }
    if (this._state !== SSE_STATE.IDLE) {
      this._setState(SSE_STATE.DISCONNECTED);
    }
  }
}
