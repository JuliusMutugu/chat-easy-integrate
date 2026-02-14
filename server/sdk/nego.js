/**
 * Nego SDK v1.0 – Embeddable chat widget for customer websites.
 *
 * Embed: <script src="https://yourserver.com/sdk/nego.js" data-nego-token="TOKEN" data-nego-url="https://yourserver.com"></script>
 *
 * Programmatic: Nego.init({ token: "TOKEN", url: "https://yourserver.com", ...options })
 *
 * @see https://github.com/nego/docs
 */
(function (global) {
  "use strict";

  var VERSION = "1.0.0";

  function Nego(options) {
    if (!(this instanceof Nego)) return new Nego(options);
    this._config = Object.assign(
      {
        token: null,
        url: null,
        position: "bottom-right", // bottom-right | bottom-left
        offset: { x: 20, y: 20 },
        primaryColor: "#059669",
        headerColor: "#1e293b",
        greeting: "No messages yet. Say hi!",
        placeholder: "Type a message...",
        title: "Chat",
        width: 380,
        height: 500,
        maxHeight: "70vh",
        zIndex: 2147483647,
        onOpen: null,
        onClose: null,
        onMessage: null,
        onConnect: null,
        onError: null,
      },
      options || {}
    );
    this._state = { open: false, connected: false, messages: [], visitorId: null, roomId: null, roomName: "", socket: null, widget: null };
    this._visitorId = "Visitor-" + Math.random().toString(36).slice(2, 9);
  }

  Nego.prototype._loadScript = function (src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  };

  Nego.prototype._escapeHtml = function (s) {
    if (s == null) return "";
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  };

  Nego.prototype._renderMessages = function () {
    var self = this;
    var el = document.getElementById("nego-widget-messages");
    if (!el) return;
    if (this._state.messages.length === 0) {
      el.innerHTML = '<div id="nego-widget-empty">' + this._escapeHtml(this._config.greeting) + "</div>";
      return;
    }
    el.innerHTML = this._state.messages
      .map(function (m) {
        var isUser = m.username === self._visitorId;
        var text = typeof m.message === "string" ? m.message : (m.message && m.message.text) || JSON.stringify(m.message);
        return (
          '<div class="nego-msg nego-msg-' +
          (isUser ? "user" : "other") +
          '"><div class="nego-msg-label">' +
          self._escapeHtml(m.username) +
          "</div>" +
          self._escapeHtml(text) +
          "</div>"
        );
      })
      .join("");
    el.scrollTop = el.scrollHeight;
  };

  Nego.prototype._applyStyles = function () {
    var c = this._config;
    var pos = c.position === "bottom-left" ? "left" : "right";
    var opposite = pos === "right" ? "left" : "right";
    var css =
      "#nego-widget * { box-sizing: border-box; }" +
      "#nego-widget { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: fixed; bottom: " +
      (c.offset.y || 20) +
      "px; " +
      pos +
      ": " +
      (c.offset.x || 20) +
      "px; z-index: " +
      c.zIndex +
      "; }" +
      "#nego-widget-btn { width: 56px; height: 56px; border-radius: 50%; border: none; background: " +
      c.primaryColor +
      "; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(5,150,105,0.4); transition: transform 0.15s, background 0.15s; }" +
      "#nego-widget-btn:hover { filter: brightness(1.1); transform: scale(1.05); }" +
      "#nego-widget-panel { position: absolute; bottom: 72px; " +
      pos +
      ": 0; " +
      opposite +
      ": auto; width: " +
      c.width +
      "px; max-width: calc(100vw - 40px); height: " +
      c.height +
      "px; max-height: " +
      c.maxHeight +
      "; background: #fff; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); border: 1px solid #e5e7eb; display: none; flex-direction: column; overflow: hidden; }" +
      "#nego-widget-panel.open { display: flex; }" +
      "#nego-widget-header { padding: 1rem 1.25rem; background: " +
      c.headerColor +
      "; color: #fff; flex-shrink: 0; }" +
      "#nego-widget-header h3 { margin: 0; font-size: 1.125rem; }" +
      "#nego-widget-header p { margin: 0.25rem 0 0; font-size: 0.8125rem; opacity: 0.9; }" +
      "#nego-widget-messages { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; min-height: 120px; }" +
      "#nego-widget-messages .nego-msg { max-width: 85%; }" +
      "#nego-widget-messages .nego-msg-user { align-self: flex-end; background: #d1fae5; color: #065f46; border-radius: 12px; padding: 0.5rem 0.75rem; font-size: 0.9375rem; }" +
      "#nego-widget-messages .nego-msg-other { align-self: flex-start; background: #f3f4f6; color: #111; border-radius: 12px; padding: 0.5rem 0.75rem; font-size: 0.9375rem; }" +
      "#nego-widget-messages .nego-msg-label { font-size: 0.7rem; color: #6b7280; margin-bottom: 0.25rem; }" +
      "#nego-widget-input-wrap { padding: 1rem; border-top: 1px solid #e5e7eb; display: flex; gap: 0.5rem; flex-shrink: 0; }" +
      "#nego-widget-input { flex: 1; padding: 0.625rem 0.875rem; font-size: 0.9375rem; border: 1px solid #e5e7eb; border-radius: 10px; resize: none; min-height: 40px; font-family: inherit; }" +
      "#nego-widget-input:focus { outline: none; border-color: " +
      c.primaryColor +
      "; }" +
      "#nego-widget-send { padding: 0.625rem 1rem; font-size: 0.9375rem; font-weight: 600; background: " +
      c.primaryColor +
      "; color: #fff; border: none; border-radius: 10px; cursor: pointer; }" +
      "#nego-widget-send:hover:not(:disabled) { filter: brightness(1.1); }" +
      "#nego-widget-send:disabled { opacity: 0.5; cursor: not-allowed; }" +
      "#nego-widget-empty { color: #6b7280; font-size: 0.9375rem; text-align: center; padding: 2rem; }";
    var style = document.createElement("style");
    style.id = "nego-widget-styles";
    style.textContent = css;
    document.head.appendChild(style);
  };

  Nego.prototype._createDOM = function () {
    var self = this;
    var c = this._config;
    var wrap = document.createElement("div");
    wrap.id = "nego-widget";
    wrap.innerHTML =
      '<button id="nego-widget-btn" aria-label="Open chat">' +
      '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' +
      "</button>" +
      '<div id="nego-widget-panel">' +
      '<div id="nego-widget-header"><h3>' +
      this._escapeHtml(c.title) +
      '</h3><p id="nego-widget-room-name">' +
      this._escapeHtml(this._state.roomName || "Chat") +
      "</p></div>" +
      '<div id="nego-widget-messages"></div>' +
      '<div id="nego-widget-input-wrap">' +
      '<textarea id="nego-widget-input" placeholder="' +
      this._escapeHtml(c.placeholder) +
      '" rows="1"></textarea>' +
      '<button id="nego-widget-send">Send</button>' +
      "</div></div>";
    document.body.appendChild(wrap);

    var btn = document.getElementById("nego-widget-btn");
    var panel = document.getElementById("nego-widget-panel");
    var roomNameEl = document.getElementById("nego-widget-room-name");
    var inputEl = document.getElementById("nego-widget-input");
    var sendBtn = document.getElementById("nego-widget-send");

    btn.addEventListener("click", function () {
      self._state.open = !self._state.open;
      panel.classList.toggle("open", self._state.open);
      if (self._state.open && c.onOpen) c.onOpen();
      else if (!self._state.open && c.onClose) c.onClose();
    });

    sendBtn.addEventListener("click", function () {
      self.sendMessage();
    });

    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        self.sendMessage();
      }
    });

    this._state.widget = { btn, panel, roomNameEl, inputEl, sendBtn };
    this._renderMessages();
  };

  Nego.prototype._connect = function () {
    var self = this;
    var c = this._config;
    var url = (c.url || "").replace(/\/$/, "");
    var token = c.token;
    var roomId = this._state.roomId;

    if (!url || !token || !roomId) {
      if (c.onError) c.onError(new Error("Missing token, url, or roomId"));
      return;
    }

    this._loadScript(url + "/socket.io/socket.io.js")
      .then(function () {
        self._state.socket = global.io(url, {
          transports: ["websocket", "polling"],
          query: { widgetToken: token, roomId: roomId },
        });

        self._state.socket.on("connect", function () {
          self._state.socket.emit("join-room", { roomId: roomId, username: self._visitorId });
          self._state.connected = true;
          if (c.onConnect) c.onConnect();
        });

        self._state.socket.on("message-history", function (history) {
          self._state.messages = (history || []).map(function (m) {
            return { id: m.id, username: m.username, message: m.message, timestamp: m.timestamp };
          });
          self._renderMessages();
        });

        self._state.socket.on("new-message", function (m) {
          self._state.messages.push({ id: m.id, username: m.username, message: m.message, timestamp: m.timestamp });
          self._renderMessages();
          if (c.onMessage) c.onMessage(m);
        });

        self._state.socket.on("error", function (e) {
          var el = document.getElementById("nego-widget-messages");
          if (el) el.innerHTML = '<div id="nego-widget-empty" style="color:#dc2626">' + (e.message || "Connection error") + "</div>";
          if (c.onError) c.onError(new Error(e.message || "Connection error"));
        });
      })
      .catch(function (err) {
        if (c.onError) c.onError(err);
        console.warn("[Nego] Failed to load Socket.io:", err);
      });
  };

  /**
   * Initialize and load the widget. Returns a Promise that resolves with the Nego instance.
   */
  Nego.prototype.init = function () {
    var self = this;
    var c = this._config;
    var url = (c.url || "").replace(/\/$/, "");
    var token = c.token;

    if (!url || !token) {
      return Promise.reject(new Error("Nego.init requires token and url"));
    }

    return fetch(url + "/api/widget/init?token=" + encodeURIComponent(token))
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.error) throw new Error(data.error);
        self._state.roomId = data.roomId;
        self._state.roomName = data.roomName || "Chat";
        self._applyStyles();
        self._createDOM();
        if (self._state.widget && self._state.widget.roomNameEl) {
          self._state.widget.roomNameEl.textContent = self._state.roomName;
        }
        self._connect();
        return self;
      })
      .catch(function (err) {
        if (c.onError) c.onError(err);
        throw err;
      });
  };

  /**
   * Open the chat panel.
   */
  Nego.prototype.open = function () {
    this._state.open = true;
    var panel = document.getElementById("nego-widget-panel");
    if (panel) panel.classList.add("open");
    if (this._config.onOpen) this._config.onOpen();
  };

  /**
   * Close the chat panel.
   */
  Nego.prototype.close = function () {
    this._state.open = false;
    var panel = document.getElementById("nego-widget-panel");
    if (panel) panel.classList.remove("open");
    if (this._config.onClose) this._config.onClose();
  };

  /**
   * Toggle the chat panel.
   */
  Nego.prototype.toggle = function () {
    this._state.open = !this._state.open;
    var panel = document.getElementById("nego-widget-panel");
    if (panel) panel.classList.toggle("open", this._state.open);
  };

  /**
   * Send a message. If no argument, sends the current input value.
   */
  Nego.prototype.sendMessage = function (text) {
    var inputEl = document.getElementById("nego-widget-input");
    var msg = text != null ? String(text).trim() : (inputEl ? inputEl.value : "").trim();
    if (!msg || !this._state.socket) return false;
    this._state.socket.emit("send-message", { message: msg, type: "text" });
    if (inputEl) inputEl.value = "";
    return true;
  };

  /**
   * Get the current state.
   */
  Nego.prototype.getState = function () {
    return {
      open: this._state.open,
      connected: this._state.connected,
      messages: this._state.messages.slice(),
      visitorId: this._visitorId,
      roomId: this._state.roomId,
      roomName: this._state.roomName,
    };
  };

  /**
   * Destroy the widget and remove it from the DOM.
   */
  Nego.prototype.destroy = function () {
    if (this._state.socket) this._state.socket.disconnect();
    var wrap = document.getElementById("nego-widget");
    if (wrap) wrap.remove();
    var style = document.getElementById("nego-widget-styles");
    if (style) style.remove();
  };

  Nego.version = VERSION;

  /**
   * Initialize from script tag or programmatically.
   * Usage: Nego.init({ token, url, ... }) or auto-init from data attributes.
   */
  function initFromScript() {
    var script = document.currentScript;
    if (!script) return;
    var token = script.getAttribute("data-nego-token");
    var url = (script.getAttribute("data-nego-url") || (script.src && script.src.replace(/\/sdk\/nego\.js.*$/, "")) || "").replace(/\/$/, "");
    if (!token || !url) {
      console.warn("[Nego] Missing data-nego-token or data-nego-url");
      return;
    }
    var opts = { token: token, url: url };
    var pos = script.getAttribute("data-nego-position");
    if (pos === "bottom-left") opts.position = "bottom-left";
    var color = script.getAttribute("data-nego-color");
    if (color) opts.primaryColor = color;
    var greeting = script.getAttribute("data-nego-greeting");
    if (greeting) opts.greeting = greeting;
    var title = script.getAttribute("data-nego-title");
    if (title) opts.title = title;
    var instance = new Nego(opts);
    instance.init().then(function () {
      global.NegoWidget = instance;
    }).catch(function () {});
  }

  global.Nego = Nego;
  global.Nego.init = function (options) {
    return new Nego(options).init();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initFromScript);
  } else {
    initFromScript();
  }
})(typeof window !== "undefined" ? window : this);
