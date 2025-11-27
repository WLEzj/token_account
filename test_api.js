const sqlite3 = require('sqlite3').verbose();
const DB_PATH = require('path').join(__dirname, 'accounts.db');

async function main() {
  const base = 'http://localhost:3000';
  const username = 'u' + Date.now();
  const password = 'P@ssw0rd';

  console.log('Registering user:', username);
  const regRes = await fetch(base + '/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const regText = await regRes.text();
  console.log('Register status:', regRes.status, regText);

  // extract sid cookie
  const setCookie = regRes.headers.get('set-cookie') || '';
  const sidMatch = setCookie.match(/sid=([^;]+)/);
  const sid = sidMatch ? sidMatch[1] : null;
  console.log('sid from register:', sid);

  // create a transaction
  const tx = {
    type: 'expense',
    amount: 12.34,
    date: new Date().toISOString().slice(0,10),
    category: { id: 'food', name: '餐饮', color: '#EF4444', icon: 'utensils' },
    note: 'test tx'
  };

  console.log('Creating transaction...');
  const createRes = await fetch(base + '/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(sid ? { Cookie: `sid=${sid}` } : {}) },
    body: JSON.stringify(tx)
  });
  const createText = await createRes.text();
  console.log('Create status:', createRes.status, createText);

  console.log('Fetching transactions...');
  const listRes = await fetch(base + '/api/transactions', { headers: { ...(sid ? { Cookie: `sid=${sid}` } : {}) } });
  const listJson = await listRes.json();
  console.log('List status:', listRes.status, JSON.stringify(listJson, null, 2));

  // delete if exists
  if (Array.isArray(listJson.transactions) && listJson.transactions.length > 0) {
    const id = listJson.transactions[0].id;
    console.log('Deleting transaction id', id);
    const delRes = await fetch(base + '/api/transactions/' + id, { method: 'DELETE', headers: { ...(sid ? { Cookie: `sid=${sid}` } : {}) } });
    console.log('Delete status:', delRes.status, await delRes.text());
  }

  // Query DB
  console.log('Querying accounts.db for users and transactions...');
  const db = new sqlite3.Database(DB_PATH);
  db.serialize(() => {
    db.all('SELECT id, username, created_at FROM users', (err, rows) => {
      if (err) return console.error('DB users error', err);
      console.log('Users in DB:', rows);
    });
    db.all('SELECT id, user_id, type, amount, date, note FROM transactions', (err, rows) => {
      if (err) return console.error('DB transactions error', err);
      console.log('Transactions in DB:', rows);
    });
  });
  // allow some time for prints
  setTimeout(() => db.close(), 1000);
}

main().catch(err => { console.error(err); process.exit(1); });
