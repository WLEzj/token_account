// 导入必要的模块
const express = require('express'); // Express.js 框架
const path = require('path'); // 路径处理
const sqlite3 = require('sqlite3').verbose(); // SQLite 数据库
const bodyParser = require('body-parser'); // 解析请求体
const session = require('express-session'); // 会话管理
const SQLiteStore = require('connect-sqlite3')(session); // SQLite 会话存储
const cors = require('cors'); // 跨域资源共享
const bcrypt = require('bcryptjs'); // 密码哈希
const helmet = require('helmet'); // 安全头部设置
const rateLimit = require('express-rate-limit'); // 请求频率限制

// 加载环境变量（如果存在）
try { require('dotenv').config(); } catch (e) {}

// 创建 Express 应用
const app = express();
// 数据库文件路径
const DB_PATH = path.join(__dirname, 'accounts.db');

// 配置中间件
app.use(bodyParser.json()); // 解析 JSON 请求体
app.use(express.static(path.join(__dirname))); // 静态文件服务

// 设置安全头部
app.use(helmet());

// 身份验证请求频率限制
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 最大请求数
  message: { error: '请求过于频繁，请稍后重试' }
});

// 配置 CORS，允许跨域请求
app.use(cors({ origin: true, credentials: true }));

// 生产环境下信任代理
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// 初始化数据库连接
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('打开数据库失败', err);
    process.exit(1);
  }
});

// 创建数据库表（如果不存在）
db.serialize(() => {
  // 用户表
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password_hash TEXT,
    created_at TEXT
  )`);

  // 交易记录表
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT,
    amount REAL,
    date TEXT,
    category_id TEXT,
    category_name TEXT,
    category_color TEXT,
    category_icon TEXT,
    note TEXT,
    created_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  // 预算表
  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    user_id TEXT PRIMARY KEY,
    amount REAL NOT NULL DEFAULT 0,
    updated_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
});

// bcrypt-based hashing
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}
// 使用 express-session + sqlite 存储会话
app.use(session({
  name: 'sid',
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 1 day
    sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax', // ← 改成 'lax'
    secure: process.env.NODE_ENV === 'production'
  }
}));

// 简单请求日志（方便调试 cookie / session）
app.use((req, res, next) => {
  try {
    const cookie = req.headers && (req.headers.cookie || '-');
    const sid = req.session && req.session.userId ? req.session.userId : '-';
    const user = req.user ? `${req.user.username}(${req.user.id})` : '-';
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} cookie=${cookie} sessionUserId=${sid} user=${user}`);
  } catch (e) {
    // ignore logging errors
  }
  next();
});

// 中间件：鉴权（从 session 中读取 userId） - 调试版
function authMiddleware(req, res, next) {
  const userId = req.session && req.session.userId;
  console.log('authMiddleware - session.userId:', userId);
  if (!userId) return next();
  db.get('SELECT id, username FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.log('authMiddleware - db error:', err.message);
      return next();
    }
    console.log('authMiddleware - db row:', row);
    if (!row) return next();
    req.user = row;
    next();
  });
}

app.use(authMiddleware);

// 全局API缓存控制（禁用浏览器缓存和ETag）
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.etag = false; // 禁用ETag避免304响应
  next();
});

// 注册
app.post('/api/register', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码是必须的' });
  const id = Date.now().toString();
  (async () => {
    try {
      const password_hash = await hashPassword(password);
      const created_at = new Date().toISOString();
      db.run('INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)', [id, username, password_hash, created_at], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(409).json({ error: '用户名已存在' });
          return res.status(500).json({ error: '数据库错误' });
        }
        // 创建 session
        req.session.userId = id;
  console.log('session after register:', req.session);
        res.json({ id, username });
      });
    } catch (e) {
      console.error('Hash error', e);
      res.status(500).json({ error: '服务器错误' });
    }
  })();
});

// 登录
app.post('/api/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: '用户名和密码是必须的' });
  db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], async (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    if (!row) return res.status(401).json({ error: '用户名或密码错误' });
    try {
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: '用户名或密码错误' });
      req.session.userId = row.id;
  console.log('session after login:', req.session);
      res.json({ id: row.id, username: row.username });
    } catch (e) {
      return res.status(500).json({ error: '服务器错误' });
    }
  });
});

// 登出
app.post('/api/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(err => {
      // 忽略错误，清理 cookie
    });
  }
  res.json({ ok: true });
});

// 当前用户 (禁用浏览器缓存)
app.get('/api/current', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// 预算
app.get('/api/budget', (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  db.get('SELECT amount FROM budgets WHERE user_id = ?', [userId], (err, row) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ amount: row ? row.amount : 0 });
  });
});

app.post('/api/budget', (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  const { amount } = req.body;
  const normalized = Number(amount);
  if (Number.isNaN(normalized) || normalized < 0) {
    return res.status(400).json({ error: '预算必须是非负数字' });
  }
  const updated_at = new Date().toISOString();
  db.run(
    `INSERT INTO budgets (user_id, amount, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET amount=excluded.amount, updated_at=excluded.updated_at`,
    [userId, normalized, updated_at],
    function(err) {
      if (err) return res.status(500).json({ error: '数据库错误' });
      res.json({ amount: normalized });
    }
  );
});

// 交易 CRUD (禁用浏览器缓存)
app.get('/api/transactions', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ transactions: rows });
  });
});

app.post('/api/transactions', (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  const t = req.body;
  const id = Date.now().toString();
  db.run(`INSERT INTO transactions (id, user_id, type, amount, date, category_id, category_name, category_color, category_icon, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, userId, t.type, t.amount, t.date, t.category?.id, t.category?.name, t.category?.color, t.category?.icon, t.note, new Date().toISOString()], function(err) {
      if (err) return res.status(500).json({ error: '数据库错误' });
      res.json({ id, ...t });
    });
});

app.put('/api/transactions/:id', (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  const id = req.params.id;
  const t = req.body;
  db.run(`UPDATE transactions SET type=?, amount=?, date=?, category_id=?, category_name=?, category_color=?, category_icon=?, note=? WHERE id=? AND user_id=?`,
    [t.type, t.amount, t.date, t.category?.id, t.category?.name, t.category?.color, t.category?.icon, t.note, id, userId], function(err) {
      if (err) return res.status(500).json({ error: '数据库错误' });
      res.json({ ok: true });
    });
});

app.delete('/api/transactions/:id', (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });
  const id = req.params.id;
  db.run('DELETE FROM transactions WHERE id=? AND user_id=?', [id, userId], function(err) {
    if (err) return res.status(500).json({ error: '数据库错误' });
    res.json({ ok: true });
  });
});

// 批量导入交易（受保护）
// 接受 JSON: { transactions: [...], mode?: 'merge'|'replace', budget?: number }
app.post('/api/transactions/import', async (req, res) => {
  const userId = req.user ? req.user.id : null;
  if (!userId) return res.status(401).json({ error: '需要登录' });

  const body = req.body || {};
  const txs = Array.isArray(body.transactions) ? body.transactions : null;
  const mode = body.mode === 'replace' ? 'replace' : 'merge';
  const budget = typeof body.budget === 'number' ? Number(body.budget) : null;

  if (!txs) return res.status(400).json({ error: '必须提供 transactions 数组' });

  // helper to run SQL with Promise
  function runAsync(sql, params) {
    return new Promise((resolve, reject) => {
      db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve(this);
      });
    });
  }

  // Build insert statement depending on mode
  const insertSql = mode === 'replace'
    ? `INSERT OR REPLACE INTO transactions (id, user_id, type, amount, date, category_id, category_name, category_color, category_icon, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    : `INSERT OR IGNORE INTO transactions (id, user_id, type, amount, date, category_id, category_name, category_color, category_icon, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  // perform in transaction
  try {
    await runAsync('BEGIN TRANSACTION');

    if (mode === 'replace') {
      // remove existing transactions for user before inserting (to allow clean replace)
      await runAsync('DELETE FROM transactions WHERE user_id = ?', [userId]);
    }

    let inserted = 0;
    let ignored = 0;
    for (const t of txs) {
      try {
        const id = t.id ? String(t.id) : Date.now().toString() + Math.floor(Math.random() * 1000);
        const type = t.type === 'income' ? 'income' : 'expense';
        // amount may come as amount (number) or amountCents
        let amount = 0;
        if (typeof t.amount === 'number') {
          amount = Number(t.amount);
        } else if (typeof t.amountCents === 'number') {
          amount = Number(t.amountCents) / 100; // store as real in DB for compatibility
        } else if (typeof t.amount === 'string') {
          amount = Number(t.amount) || 0;
        }
        const date = t.date || new Date().toISOString().slice(0,10);
        const category_id = t.category && t.category.id ? t.category.id : null;
        const category_name = t.category && t.category.name ? t.category.name : null;
        const category_color = t.category && t.category.color ? t.category.color : null;
        const category_icon = t.category && t.category.icon ? t.category.icon : null;
        const note = t.note ? String(t.note) : null;
        const created_at = t.createdAt || t.created_at || new Date().toISOString();

        const result = await runAsync(insertSql, [id, userId, type, amount, date, category_id, category_name, category_color, category_icon, note, created_at]);
        // If using INSERT OR IGNORE, sqlite returns lastID=0 and changes=0 when ignored
        if (result && result.changes && result.changes > 0) {
          inserted++;
        } else if (mode === 'merge') {
          ignored++;
        } else {
          inserted++;
        }
      } catch (e) {
        // continue on per-row error, but record
        console.warn('导入单条交易失败', e && e.message);
      }
    }

    // import budget if provided
    if (budget !== null) {
      const updated_at = new Date().toISOString();
      await runAsync(
        `INSERT INTO budgets (user_id, amount, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET amount=excluded.amount, updated_at=excluded.updated_at`,
        [userId, budget, updated_at]
      );
    }

    await runAsync('COMMIT');
    return res.json({ ok: true, mode, inserted, ignored, total: txs.length });
  } catch (err) {
    console.error('批量导入失败', err);
    try { await runAsync('ROLLBACK'); } catch (e) {}
    return res.status(500).json({ error: '批量导入失败' });
  }
});

// AI 分析路由：将事务样本转发到上游 AI 服务（支持本地 mock）
app.post('/api/ai/analyze', async (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || process.env.API_KEY;
  const apiUrl = process.env.DEEPSEEK_API_URL || process.env.DEEPSEEK_URL || '';

  try {
    const payload = { transactions: Array.isArray(req.body && req.body.transactions) ? req.body.transactions : [] };
    const controller = new AbortController();
    const timeoutMs = 20000; // 20s upstream timeout
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const upstreamRes = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!upstreamRes.ok) {
      const text = await upstreamRes.text().catch(() => '');
      console.error('Deepseek upstream error', upstreamRes.status, text);
      return res.status(502).json({ error: '调用 Deepseek 出错（上游返回错误）' });
    }

    // 尝试解析为 JSON，否则返回原始文本
    let data;
    try { data = await upstreamRes.json(); } catch (e) { data = { text: await upstreamRes.text().catch(() => '') }; }
    return res.json({ data });
  } catch (e) {
    console.error('调用 Deepseek 出错, url=', apiUrl, 'error=', e && e.message);
    if (e && e.name === 'AbortError') {
      return res.status(502).json({ error: '调用上游超时' });
    }
    return res.status(502).json({ error: '调用 Deepseek 出错（网络或服务错误）', detail: String(e) });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});