const express = require('express');
const app = express();
const PORT = 2000;

let pendingRequest = null;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// 网页面板
// =============================================
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Official Site</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui;background:#1a1a2e;color:#eee;min-height:100vh;display:flex;flex-direction:column;align-items:center;padding:16px}
h1{font-size:20px;margin-bottom:12px;color:#e94560}
#status{padding:10px 16px;border-radius:8px;margin-bottom:12px;font-size:14px;width:100%;max-width:600px;text-align:center}
.waiting{background:#0f3460;color:#a8d8ea}
.has-request{background:#e94560;color:#fff;animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.7}}
#user-msg{width:100%;max-width:600px;background:#16213e;border:1px solid #0f3460;border-radius:8px;padding:12px;margin-bottom:12px;color:#a8d8ea;font-size:13px;max-height:150px;overflow-y:auto;white-space:pre-wrap;word-break:break-all}
textarea{width:100%;max-width:600px;height:200px;background:#16213e;color:#eee;border:1px solid #0f3460;border-radius:8px;padding:12px;font-size:14px;resize:vertical;font-family:monospace}
textarea:focus{outline:none;border-color:#e94560}
button{margin-top:12px;padding:12px 32px;background:#e94560;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer;width:100%;max-width:600px}
button:disabled{background:#555;cursor:not-allowed}
button:active:not(:disabled){background:#c81e45}
#log{margin-top:16px;font-size:12px;color:#666;width:100%;max-width:600px;text-align:center}
</style></head><body>
<h1>Official Site 控制台</h1>
<div id="status" class="waiting">⏳ 等待请求...</div>
<div id="user-msg" style="display:none"></div>
<textarea id="reply" placeholder="在此粘贴回复内容..." disabled></textarea>
<button id="send" disabled onclick="sendReply()">发送回复</button>
<div id="log"></div>
<script>
let polling;
function poll(){
  fetch('/panel/status').then(r=>r.json()).then(d=>{
    if(d.pending){
      document.getElementById('status').className='has-request';
      document.getElementById('status').textContent='📨 有新请求！请输入回复';
      document.getElementById('user-msg').style.display='block';
      document.getElementById('user-msg').textContent=d.userMessage;
      document.getElementById('reply').disabled=false;
      document.getElementById('send').disabled=false;
      document.getElementById('reply').focus();
    }else{
      document.getElementById('status').className='waiting';
      document.getElementById('status').textContent='⏳ 等待请求...';
      document.getElementById('user-msg').style.display='none';
      document.getElementById('reply').disabled=true;
      document.getElementById('send').disabled=true;
    }
  }).catch(()=>{});
}
function sendReply(){
  const text=document.getElementById('reply').value;
  if(!text)return;
  fetch('/panel/reply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:text})}).then(r=>r.json()).then(d=>{
    if(d.ok){
      document.getElementById('reply').value='';
      document.getElementById('log').textContent='✅ 已发送 ('+new Date().toLocaleTimeString()+')';
      poll();
    }
  });
}
document.getElementById('reply').addEventListener('keydown',function(e){
  if(e.key==='Enter'&&e.ctrlKey){e.preventDefault();sendReply();}
});
polling=setInterval(poll,1000);
poll();
</script></body></html>`);
});

// 面板状态接口
app.get('/panel/status', (req, res) => {
  if (pendingRequest) {
    res.json({ pending: true, userMessage: pendingRequest.userMessage });
  } else {
    res.json({ pending: false });
  }
});

// 面板回复接口
app.post('/panel/reply', (req, res) => {
  if (pendingRequest && req.body.content) {
    pendingRequest.resolve(req.body.content);
    pendingRequest = null;
    res.json({ ok: true });
  } else {
    res.json({ ok: false });
  }
});

// =============================================
// OpenAI 兼容接口
// =============================================
function waitForHuman(userMessage) {
  return new Promise((resolve) => {
    pendingRequest = { userMessage, resolve };
    console.log('📨 收到请求，请在网页面板回复');
  });
}

const modelsData = { object: 'list', data: [{ id: 'own', object: 'model', created: 1700000000, owned_by: 'official-site', permission: [{ id: 'modelperm-own', object: 'model_permission', created: 1700000000, allow_create_engine: false, allow_sampling: true, allow_logprobs: true, allow_search_indices: false, allow_view: true, allow_fine_tuning: false, organization: '*', group: null, is_blocking: false }], root: 'own', parent: null }] };
app.get('/v1/models', (req, res) => res.json(modelsData));
app.get('/models', (req, res) => res.json(modelsData));
app.get('/v1/models/:model', (req, res) => res.json(modelsData.data[0]));
app.get('/models/:model', (req, res) => res.json(modelsData.data[0]));

app.post('/v1/chat/completions', async (req, res) => {
  const { messages, stream, model } = req.body;
  let cancelled = false;
  res.on('close', () => {
    if (!res.writableFinished) {
      cancelled = true;
      if (pendingRequest) {
        pendingRequest = null;
        console.log('⚠️ 客户端已断开');
      }
    }
  });
  let userMessage = '';
  if (messages && messages.length > 0) {
    const last = messages[messages.length - 1];
    userMessage = typeof last.content === 'string' ? last.content : JSON.stringify(last.content);
  }
  const humanReply = await waitForHuman(userMessage);
  if (cancelled) return;
  const messageId = 'chatcmpl-' + Math.random().toString(36).slice(2);
  const created = Math.floor(Date.now() / 1000);
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.write(`data: ${JSON.stringify({ id: messageId, object: 'chat.completion.chunk', created, model: model || 'own', choices: [{ index: 0, delta: { role: 'assistant', content: '' }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ id: messageId, object: 'chat.completion.chunk', created, model: model || 'own', choices: [{ index: 0, delta: { content: humanReply }, finish_reason: null }] })}\n\n`);
    res.write(`data: ${JSON.stringify({ id: messageId, object: 'chat.completion.chunk', created, model: model || 'own', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  res.json({ id: messageId, object: 'chat.completion', created, model: model || 'own', choices: [{ index: 0, message: { role: 'assistant', content: humanReply }, finish_reason: 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } });
});
app.post('/chat/completions', async (req, res) => { req.url = '/v1/chat/completions'; app.handle(req, res); });
app.listen(PORT, '0.0.0.0', () => {
  console.log('official-site API 已启动 → http://0.0.0.0:' + PORT);
  console.log('网页面板 → http://127.0.0.1:' + PORT);
});
