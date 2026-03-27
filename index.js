const express = require('express');
const readline = require('readline');
const app = express();
const PORT = 2000;
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());
function askHuman() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('请输入官网回复内容: ', (answer) => { rl.close(); resolve(answer); });
  });
}
const modelsData = { object: 'list', data: [{ id: 'own', object: 'model', created: 1700000000, owned_by: 'official-site', permission: [{ id: 'modelperm-own', object: 'model_permission', created: 1700000000, allow_create_engine: false, allow_sampling: true, allow_logprobs: true, allow_search_indices: false, allow_view: true, allow_fine_tuning: false, organization: '*', group: null, is_blocking: false }], root: 'own', parent: null }] };
app.get('/v1/models', (req, res) => res.json(modelsData));
app.get('/models', (req, res) => res.json(modelsData));
app.get('/v1/models/:model', (req, res) => res.json(modelsData.data[0]));
app.get('/models/:model', (req, res) => res.json(modelsData.data[0]));
app.post('/v1/chat/completions', async (req, res) => {
  const { stream, model } = req.body;
  const humanReply = await askHuman();
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
app.listen(PORT, '0.0.0.0', () => { console.log('official-site API 已启动 → http://0.0.0.0:' + PORT); });
