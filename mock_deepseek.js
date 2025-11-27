// 简单的 mock Deepseek API，便于本地测试 /api/ai/analyze
const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json());

app.post('/v1/analyze', (req, res) => {
  const txs = Array.isArray(req.body.transactions) ? req.body.transactions : [];
  // 返回简易分析文本
  const total = txs.length;
  const income = txs.filter(t => t.type === 'income').length;
  const expense = txs.filter(t => t.type === 'expense').length;
  res.json({ analysis: `sampleCount=${total}, income=${income}, expense=${expense}`, summary: { total, income, expense } });
});

const PORT = 4000;
app.listen(PORT, () => console.log(`Mock Deepseek listening on http://localhost:${PORT}/v1/analyze`));
