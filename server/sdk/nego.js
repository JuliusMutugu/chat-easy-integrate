/**
 * Nego SDK – Embeddable chat widget for customer websites.
 * Usage: <script src="https://yourserver.com/sdk/nego.js" data-nego-token="TOKEN" data-nego-url="https://yourserver.com"></script>
 */
(function () {
  "use strict";
  const script = document.currentScript;
  if (!script) return;

  const token = script.getAttribute("data-nego-token");
  const baseUrl = (script.getAttribute("data-nego-url") || script.src.replace(/\/sdk\/nego\.js.*$/, "")).replace(/\/$/, "");
  if (!token || !baseUrl) {
    console.warn("[Nego] Missing data-nego-token or data-nego-url");
    return;
  }

  const visitorId = "Visitor-" + Math.random().toString(36).slice(2, 9);
  let socket = null;
  let roomId = null;
  let roomName = "";
  let open = false;
  let messages = [];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initWidget() {
    const wrap = document.createElement("div");
    wrap.id = "nego-widget";
    wrap.innerHTML = `
      <style>
        #nego-widget * { box-sizing: border-box; }
        #nego-widget {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 2147483647;
        }
        #nego-widget-btn {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: none;
          background: #059669;
          color: #fff;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 16px rgba(5, 150, 105, 0.4);
          transition: transform 0.15s, background 0.15s;
        }
        #nego-widget-btn:hover { background: #047857; transform: scale(1.05); }
        #nego-widget-panel {
          position: absolute;
          bottom: 72px;
          right: 0;
          width: 380px;
          max-width: calc(100vw - 40px);
          height: 500px;
          max-height: 70vh;
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.2);
          border: 1px solid #e5e7eb;
          display: none;
          flex-direction: column;
          overflow: hidden;
        }
        #nego-widget-panel.open { display: flex; }
        #nego-widget-header {
          padding: 1rem 1.25rem;
          background: #1e293b;
          color: #fff;
          flex-shrink: 0;
        }
        #nego-widget-header h3 { margin: 0; font-size: 1.125rem; }
        #nego-widget-header p { margin: 0.25rem 0 0; font-size: 0.8125rem; opacity: 0.9; }
        #nego-widget-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-height: 120px;
        }
        #nego-widget-messages .msg { max-width: 85%; }
        #nego-widget-messages .msg-user { align-self: flex-end; background: #d1fae5; color: #065f46; border-radius: 12px; padding: 0.5rem 0.75rem; font-size: 0.9375rem; }
        #nego-widget-messages .msg-other { align-self: flex-start; background: #f3f4f6; color: #111; border-radius: 12px; padding: 0.5rem 0.75rem; font-size: 0.9375rem; }
        #nego-widget-messages .msg-label { font-size: 0.7rem; color: #6b7280; margin-bottom: 0.25rem; }
        #nego-widget-input-wrap {
          padding: 1rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        #nego-widget-input {
          flex: 1;
          padding: 0.625rem 0.875rem;
          font-size: 0.9375rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          resize: none;
          min-height: 40px;
          font-family: inherit;
        }
        #nego-widget-input:focus { outline: none; border-color: #059669; }
        #nego-widget-send {
          padding: 0.625rem 1rem;
          font-size: 0.9375rem;
          font-weight: 600;
          background: #059669;
          color: #fff;
          border: none;
          border-radius: 10px;
          cursor: pointer;
        }
        #nego-widget-send:hover:not(:disabled) { background: #047857; }
        #nego-widget-send:disabled { opacity: 0.5; cursor: not-allowed; }
        #nego-widget-empty { color: #6b7280; font-size: 0.9375rem; text-align: center; padding: 2rem; }
      </style>
      <button id="nego-widget-btn" aria-label="Open chat">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>
      <div id="nego-widget-panel">
        <div id="nego-widget-header">
          <h3>Chat</h3>
          <p id="nego-widget-room-name">${roomName || "Chat"}</p>
        </div>
        <div id="nego-widget-messages"></div>
        <div id="nego-widget-input-wrap">
          <textarea id="nego-widget-input" placeholder="Type a message..." rows="1"></textarea>
          <button id="nego-widget-send">Send</button>
        </div>
      </div>
    `;

    document.body.appendChild(wrap);

    const btn = wrap.querySelector("#nego-widget-btn");
    const panel = wrap.querySelector("#nego-widget-panel");
    const roomNameEl = wrap.querySelector("#nego-widget-room-name");
    const messagesEl = wrap.querySelector("#nego-widget-messages");
    const inputEl = wrap.querySelector("#nego-widget-input");
    const sendBtn = wrap.querySelector("#nego-widget-send");

    roomNameEl.textContent = roomName || "Chat";

    function renderMessages() {
      if (messages.length === 0) {
        messagesEl.innerHTML = '<div id="nego-widget-empty">No messages yet. Say hi!</div>';
        return;
      }
      messagesEl.innerHTML = messages
        .map((m) => {
          const isUser = m.username === visitorId;
          const text = typeof m.message === "string" ? m.message : (m.message?.text || JSON.stringify(m.message));
          return `<div class="msg msg-${isUser ? "user" : "other"}"><div class="msg-label">${escapeHtml(m.username)}</div>${escapeHtml(text)}</div>`;
        })
        .join("");
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function escapeHtml(s) {
      if (s == null) return "";
      const div = document.createElement("div");
      div.textContent = s;
      return div.innerHTML;
    }

    function sendMessage() {
      const text = (inputEl.value || "").trim();
      if (!text || !socket) return;
      socket.emit("send-message", { message: text, type: "text" });
      inputEl.value = "";
    }

    btn.addEventListener("click", () => {
      open = !open;
      panel.classList.toggle("open", open);
    });

    sendBtn.addEventListener("click", sendMessage);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    return { renderMessages, setRoomName: (n) => { roomName = n; roomNameEl.textContent = n; } };
  }

  function connect() {
    loadScript(baseUrl + "/socket.io/socket.io.js")
      .then(() => {
        socket = window.io(baseUrl, {
          transports: ["websocket", "polling"],
          query: { widgetToken: token, roomId: roomId },
        });

        socket.on("connect", () => {
          socket.emit("join-room", { roomId, username: visitorId });
        });

        socket.on("message-history", (history) => {
          messages = (history || []).map((m) => ({
            id: m.id,
            username: m.username,
            message: m.message,
            timestamp: m.timestamp,
          }));
          if (widget) widget.renderMessages();
        });

        socket.on("new-message", (m) => {
          messages.push({
            id: m.id,
            username: m.username,
            message: m.message,
            timestamp: m.timestamp,
          });
          if (widget) widget.renderMessages();
        });

        socket.on("error", (e) => {
          if (widget) {
            const el = document.querySelector("#nego-widget-messages");
            if (el) el.innerHTML = '<div id="nego-widget-empty" style="color:#dc2626">' + (e.message || "Connection error") + "</div>";
          }
        });
      })
      .catch((err) => console.warn("[Nego] Failed to load Socket.io:", err));
  }

  let widget = null;

  fetch(baseUrl + "/api/widget/init?token=" + encodeURIComponent(token))
    .then((r) => r.json())
    .then((data) => {
      roomId = data.roomId;
      roomName = data.roomName || "Chat";
      widget = initWidget();
      widget.setRoomName(roomName);
      connect();
    })
    .catch((err) => {
      console.warn("[Nego] Failed to init:", err);
      const wrap = document.createElement("div");
      wrap.id = "nego-widget";
      wrap.innerHTML = '<div style="position:fixed;bottom:20px;right:20px;padding:0.75rem 1rem;background:#fef2f2;color:#dc2626;border-radius:8px;font-size:0.875rem;z-index:2147483647">Nego: Unable to load chat</div>';
      document.body.appendChild(wrap);
    });
})();
