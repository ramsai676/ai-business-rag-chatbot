/*
 * Brew Haven RAG Chat Widget - embeddable in ANY website with one script tag:
 *
 *   <script src="https://your-host/widget.js"
 *           data-api="https://your-host"
 *           data-name="Brew Haven Café"
 *           data-accent="#6c5ce7"></script>
 *
 * It self-injects styles + a floating launcher, so it never clashes with the
 * host page's CSS (scoped class prefix + isolated container).
 */
(function () {
  const script = document.currentScript;
  const API = (script && script.getAttribute('data-api')) || '';
  const NAME = (script && script.getAttribute('data-name')) || 'Support';
  const ACCENT = (script && script.getAttribute('data-accent')) || '#6c5ce7';

  const css = `
  .rhx-launcher{position:fixed;bottom:22px;right:22px;width:60px;height:60px;border-radius:50%;
    background:${ACCENT};color:#fff;border:none;cursor:pointer;font-size:26px;box-shadow:0 10px 30px -8px rgba(0,0,0,.4);
    z-index:2147483000;display:flex;align-items:center;justify-content:center;transition:transform .15s;}
  .rhx-launcher:hover{transform:scale(1.06);}
  .rhx-panel{position:fixed;bottom:94px;right:22px;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 130px);
    background:#fff;border-radius:18px;box-shadow:0 24px 60px -16px rgba(0,0,0,.45);z-index:2147483000;
    display:flex;flex-direction:column;overflow:hidden;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;
    opacity:0;transform:translateY(12px) scale(.98);pointer-events:none;transition:opacity .2s,transform .2s;}
  .rhx-panel.rhx-open{opacity:1;transform:none;pointer-events:auto;}
  .rhx-head{background:${ACCENT};color:#fff;padding:16px 18px;}
  .rhx-head h4{margin:0;font-size:16px;font-weight:700;}
  .rhx-head p{margin:2px 0 0;font-size:12px;opacity:.85;}
  .rhx-body{flex:1;overflow-y:auto;padding:16px;background:#f6f7fb;display:flex;flex-direction:column;gap:10px;}
  .rhx-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word;}
  .rhx-bot{background:#fff;color:#1a1a2e;border:1px solid #e7e8f0;border-bottom-left-radius:4px;align-self:flex-start;}
  .rhx-user{background:${ACCENT};color:#fff;border-bottom-right-radius:4px;align-self:flex-end;}
  .rhx-src{margin-top:6px;font-size:11px;color:#8a8fa3;align-self:flex-start;}
  .rhx-typing{display:flex;gap:4px;padding:12px 14px;align-self:flex-start;background:#fff;border:1px solid #e7e8f0;border-radius:14px;}
  .rhx-typing span{width:7px;height:7px;border-radius:50%;background:#b9bdce;animation:rhxb 1s infinite;}
  .rhx-typing span:nth-child(2){animation-delay:.2s;}.rhx-typing span:nth-child(3){animation-delay:.4s;}
  @keyframes rhxb{0%,60%,100%{opacity:.3;transform:translateY(0);}30%{opacity:1;transform:translateY(-4px);}}
  .rhx-foot{display:flex;gap:8px;padding:12px;border-top:1px solid #eceef4;background:#fff;}
  .rhx-foot input{flex:1;border:1px solid #d9dbe6;border-radius:10px;padding:10px 12px;font-size:14px;outline:none;}
  .rhx-foot input:focus{border-color:${ACCENT};}
  .rhx-foot button{background:${ACCENT};color:#fff;border:none;border-radius:10px;padding:0 16px;cursor:pointer;font-weight:600;}
  .rhx-foot button:disabled{opacity:.5;cursor:not-allowed;}
  .rhx-powered{text-align:center;font-size:10px;color:#aab;padding:6px;background:#fff;}`;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const launcher = document.createElement('button');
  launcher.className = 'rhx-launcher';
  launcher.setAttribute('aria-label', 'Open chat');
  launcher.textContent = '💬';

  const panel = document.createElement('div');
  panel.className = 'rhx-panel';
  panel.innerHTML = `
    <div class="rhx-head"><h4>${NAME}</h4><p>Ask us anything - we usually reply instantly.</p></div>
    <div class="rhx-body" id="rhx-body"></div>
    <div class="rhx-foot">
      <input id="rhx-input" type="text" placeholder="Type your question…" autocomplete="off" />
      <button id="rhx-send">Send</button>
    </div>
    <div class="rhx-powered">⚡ AI assistant · answers from our FAQ</div>`;

  document.body.appendChild(launcher);
  document.body.appendChild(panel);

  const body = panel.querySelector('#rhx-body');
  const input = panel.querySelector('#rhx-input');
  const sendBtn = panel.querySelector('#rhx-send');
  let opened = false;

  function addMessage(text, who, sources) {
    const div = document.createElement('div');
    div.className = `rhx-msg ${who === 'user' ? 'rhx-user' : 'rhx-bot'}`;
    div.textContent = text;
    body.appendChild(div);
    if (sources && sources.length) {
      const s = document.createElement('div');
      s.className = 'rhx-src';
      s.textContent = '📎 From: ' + sources.map((x) => x.title).join(', ');
      body.appendChild(s);
    }
    body.scrollTop = body.scrollHeight;
  }

  function showTyping() {
    const t = document.createElement('div');
    t.className = 'rhx-typing';
    t.id = 'rhx-typing';
    t.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(t);
    body.scrollTop = body.scrollHeight;
  }
  function hideTyping() {
    const t = document.getElementById('rhx-typing');
    if (t) t.remove();
  }

  async function send() {
    const q = input.value.trim();
    if (!q) return;
    addMessage(q, 'user');
    input.value = '';
    sendBtn.disabled = true;
    showTyping();
    try {
      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const data = await res.json();
      hideTyping();
      if (!res.ok) throw new Error(data.error || 'Error');
      addMessage(data.answer, 'bot', data.sources);
    } catch (err) {
      hideTyping();
      addMessage('Sorry, something went wrong. Please try again.', 'bot');
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function toggle() {
    panel.classList.toggle('rhx-open');
    launcher.textContent = panel.classList.contains('rhx-open') ? '✕' : '💬';
    if (!opened && panel.classList.contains('rhx-open')) {
      opened = true;
      addMessage(`Hi! 👋 I'm the ${NAME} assistant. Ask me about opening hours, location, the menu, Wi-Fi, bookings and more.`, 'bot');
      input.focus();
    }
  }

  launcher.addEventListener('click', toggle);
  sendBtn.addEventListener('click', send);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
})();
