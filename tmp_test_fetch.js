(async ()=>{
  try {
    const res = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'webtest_agent2', password: 'pass1234' })
    });
    console.log('status', res.status);
    for (const [k, v] of res.headers) console.log(k + ':', v);
    const txt = await res.text();
    console.log('body:', txt);
  } catch (e) {
    console.error('error', e);
  }
})();
