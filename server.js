const express = require('express');
const session = require('express-session');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Supabase clients
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const supabaseAnon = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'swiftbot-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ========== DISCORD OAUTH ==========
app.get('/auth/discord', (req, res) => {
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const scope = 'identify';
  const url = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}`;
  res.redirect(url);
});

app.get('/auth/discord/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect('/?error=oauth_failed');

  try {
    const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token', 
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
      }), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${tokenRes.data.access_token}` }
    });

    req.session.user = {
      id: userRes.data.id,
      username: userRes.data.username,
      avatar: userRes.data.avatar 
        ? `https://cdn.discordapp.com/avatars/${userRes.data.id}/${userRes.data.avatar}.png`
        : 'https://cdn.discordapp.com/embed/avatars/0.png'
    };

    res.redirect('/');
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.redirect('/?error=oauth_failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json(null);
  res.json(req.session.user);
});

// ========== BOTS API ==========
app.get('/api/bots', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .eq('user_id', req.session.user.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/bots', requireAuth, async (req, res) => {
  const { name, token } = req.body;
  if (!name || !token) return res.status(400).json({ error: 'Name and token required' });

  // Check bot limit (3 per account)
  const { data: existing } = await supabase
    .from('bots')
    .select('id')
    .eq('user_id', req.session.user.id);

  if (existing && existing.length >= 3) {
    return res.status(403).json({ error: 'Maximum 3 bots per account' });
  }

  // Verify token and get bot info
  let botInfo;
  try {
    const appRes = await axios.get('https://discord.com/api/v10/oauth2/applications/@me', {
      headers: { Authorization: `Bot ${token}` }
    });
    botInfo = appRes.data;
  } catch (err) {
    return res.status(400).json({ error: 'Invalid bot token' });
  }

  const avatarUrl = botInfo.bot?.avatar 
    ? `https://cdn.discordapp.com/avatars/${botInfo.bot.id}/${botInfo.bot.avatar}.png`
    : `https://cdn.discordapp.com/app-icons/${botInfo.id}/${botInfo.icon}.png`;

  const { data, error } = await supabase
    .from('bots')
    .insert([{
      user_id: req.session.user.id,
      name: name,
      token: token,
      avatar_url: avatarUrl || null,
      app_id: botInfo.id
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/bots/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('bots')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.session.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post('/api/bots/:id/publish', requireAuth, async (req, res) => {
  // Simulate safety check and 10-minute publish
  const { data: bot } = await supabase
    .from('bots')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.session.user.id)
    .single();

  if (!bot) return res.status(404).json({ error: 'Bot not found' });

  // Simple safety check simulation
  const { data: scripts } = await supabase
    .from('scripts')
    .select('code')
    .eq('bot_id', req.params.id);

  const allCode = (scripts || []).map(s => s.code).join(' ');
  const spamPatterns = ['spam', 'raid', 'massDM', 'nuke', 'destroy'];
  const hasSpam = spamPatterns.some(p => allCode.toLowerCase().includes(p));

  if (hasSpam) {
    return res.status(400).json({ error: 'Safety check failed: Potentially harmful code detected' });
  }

  // Schedule publish after 10 minutes
  setTimeout(async () => {
    await supabase
      .from('bots')
      .update({ is_published: true, published_at: new Date().toISOString() })
      .eq('id', req.params.id);
  }, 10 * 60 * 1000);

  res.json({ message: 'Publishing... This will take 10 minutes.', scheduled: true });
});

// ========== SCRIPTS API ==========
app.get('/api/bots/:id/scripts', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('bot_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/bots/:id/scripts', requireAuth, async (req, res) => {
  const { name, trigger, code } = req.body;
  const { data, error } = await supabase
    .from('scripts')
    .insert([{ bot_id: req.params.id, name, trigger, code: code || '' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/bots/:id/scripts/:scriptId', requireAuth, async (req, res) => {
  const { name, trigger, code } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (trigger !== undefined) update.trigger = trigger;
  if (code !== undefined) update.code = code;
  update.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('scripts')
    .update(update)
    .eq('id', req.params.scriptId)
    .eq('bot_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/bots/:id/scripts/:scriptId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('scripts')
    .delete()
    .eq('id', req.params.scriptId)
    .eq('bot_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ========== VARIABLES API ==========
app.get('/api/bots/:id/variables', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('variables')
    .select('*')
    .eq('bot_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/bots/:id/variables', requireAuth, async (req, res) => {
  const { name, current_value } = req.body;
  const { data, error } = await supabase
    .from('variables')
    .insert([{ bot_id: req.params.id, name, current_value: current_value || '' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/bots/:id/variables/:varId', requireAuth, async (req, res) => {
  const { name, current_value } = req.body;
  const update = {};
  if (name !== undefined) update.name = name;
  if (current_value !== undefined) update.current_value = current_value;

  const { data, error } = await supabase
    .from('variables')
    .update(update)
    .eq('id', req.params.varId)
    .eq('bot_id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/bots/:id/variables/:varId', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('variables')
    .delete()
    .eq('id', req.params.varId)
    .eq('bot_id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ========== COMPILER API ==========
app.post('/api/compile', requireAuth, async (req, res) => {
  const { code } = req.body;

  // FlowScript to JavaScript transpiler
  function transpile(flowCode) {
    let js = code;

    // Replace Flow-specific constructs with JS
    js = js.replace(/Flow\.if\((.+?)\)/g, 'if ($1) {');
    js = js.replace(/Flow\.elseIf\((.+?)\)/g, '} else if ($1) {');
    js = js.replace(/Flow\.else/g, '} else {');
    js = js.replace(/Flow\.endIf/g, '}');
    js = js.replace(/Flow\.while\((.+?)\)/g, 'while ($1) {');
    js = js.replace(/Flow\.endLoop/g, '}');
    js = js.replace(/Flow\.for\((.+?)\)/g, 'for ($1) {');
    js = js.replace(/Flow\.try/g, 'try {');
    js = js.replace(/Flow\.catch/g, '} catch (e) {');
    js = js.replace(/Flow\.endTry/g, '}');
    js = js.replace(/Flow\.switch\((.+?)\)/g, 'switch ($1) {');
    js = js.replace(/Flow\.case\((.+?)\)/g, 'case $1:');
    js = js.replace(/Flow\.default/g, 'default:');
    js = js.replace(/Flow\.endSwitch/g, '}');
    js = js.replace(/Flow\.break/g, 'break;');

    // Discord.js mappings
    js = js.replace(/Discord\.Message\.send\((.+?)\)/g, 'channel.send($1)');
    js = js.replace(/Discord\.Message\.reply\((.+?)\)/g, 'message.reply($1)');
    js = js.replace(/Discord\.Message\.edit\((.+?)\)/g, 'message.edit($1)');
    js = js.replace(/Discord\.Message\.delete\((.+?)\)/g, 'message.delete($1)');
    js = js.replace(/Discord\.Message\.react\((.+?)\)/g, 'message.react($1)');
    js = js.replace(/Discord\.Message\.pin\((.+?)\)/g, 'message.pin($1)');
    js = js.replace(/Discord\.Message\.unpin\((.+?)\)/g, 'message.unpin($1)');

    js = js.replace(/Discord\.User\.kick\((.+?)\)/g, 'member.kick($1)');
    js = js.replace(/Discord\.User\.ban\((.+?)\)/g, 'member.ban($1)');
    js = js.replace(/Discord\.User\.addRole\((.+?)\)/g, 'member.roles.add($1)');
    js = js.replace(/Discord\.User\.removeRole\((.+?)\)/g, 'member.roles.remove($1)');
    js = js.replace(/Discord\.User\.mute\((.+?)\)/g, 'member.timeout($1)');
    js = js.replace(/Discord\.User\.setNickname\((.+?)\)/g, 'member.setNickname($1)');

    js = js.replace(/Discord\.Guild\.ban\((.+?)\)/g, 'guild.members.ban($1)');
    js = js.replace(/Discord\.Channel\.create\((.+?)\)/g, 'guild.channels.create($1)');
    js = js.replace(/Discord\.Channel\.delete\((.+?)\)/g, 'channel.delete($1)');
    js = js.replace(/Discord\.Role\.create\((.+?)\)/g, 'guild.roles.create($1)');
    js = js.replace(/Discord\.Role\.delete\((.+?)\)/g, 'role.delete($1)');

    js = js.replace(/Discord\.Embed\./g, 'new EmbedBuilder().');

    // UI Components
    js = js.replace(/UI\.Component\.addButton\((.+?)\)/g, 'new ButtonBuilder().setCustomId($1)');
    js = js.replace(/UI\.Component\.addSelectMenu\((.+?)\)/g, 'new StringSelectMenuBuilder().setCustomId($1)');

    // Math
    js = js.replace(/Math\.abs\((.+?)\)/g, 'Math.abs($1)');
    js = js.replace(/Math\.sum\((.+?)\)/g, '($1).reduce((a,b)=>a+b,0)');
    js = js.replace(/Math\.random\((.+?)\)/g, 'Math.floor(Math.random() * ($1))');
    js = js.replace(/Math\.calculate\((.+?)\)/g, 'eval($1)');

    // Text
    js = js.replace(/Text\.upperCase\((.+?)\)/g, '($1).toUpperCase()');
    js = js.replace(/Text\.lowerCase\((.+?)\)/g, '($1).toLowerCase()');
    js = js.replace(/Text\.slice\((.+?)\)/g, '($1).slice()');
    js = js.replace(/Text\.split\((.+?)\)/g, '($1).split()');
    js = js.replace(/Text\.replace\((.+?)\)/g, '($1).replace()');
    js = js.replace(/Text\.includes\((.+?)\)/g, '($1).includes()');
    js = js.replace(/Text\.charCount\((.+?)\)/g, '($1).length');
    js = js.replace(/Text\.wordCount\((.+?)\)/g, '($1).split(/\s+/).length');
    js = js.replace(/Text\.base64Encode\((.+?)\)/g, 'Buffer.from($1).toString("base64")');
    js = js.replace(/Text\.base64Decode\((.+?)\)/g, 'Buffer.from($1, "base64").toString()');

    // Time
    js = js.replace(/Time\.timestamp/g, 'Date.now()');
    js = js.replace(/Time\.date/g, 'new Date().toDateString()');
    js = js.replace(/Time\.wait\((.+?)\)/g, 'await new Promise(r => setTimeout(r, $1 * 1000))');

    // Logic
    js = js.replace(/Logic\.and\((.+?)\)/g, '($1).every(Boolean)');
    js = js.replace(/Logic\.or\((.+?)\)/g, '($1).some(Boolean)');
    js = js.replace(/Logic\.checkCondition\((.+?)\)/g, 'Boolean($1)');

    // Database
    js = js.replace(/Database\.get\((.+?)\)/g, 'await db.get($1)');
    js = js.replace(/Database\.set\((.+?)\)/g, 'await db.set($1)');

    // Network
    js = js.replace(/Network\.api\((.+?)\)/g, 'await fetch($1)');
    js = js.replace(/Network\.httpGet\((.+?)\)/g, 'await fetch($1).then(r=>r.text())');
    js = js.replace(/Network\.httpPost\((.+?)\)/g, 'await fetch($1).then(r=>r.text())');

    // Flow control
    js = js.replace(/Flow\.log\((.+?)\)/g, 'console.log($1)');
    js = js.replace(/Flow\.eval\((.+?)\)/g, 'eval($1)');
    js = js.replace(/Flow\.exit/g, 'return;');
    js = js.replace(/Flow\.error\((.+?)\)/g, 'throw new Error($1)');

    return js;
  }

  const compiled = transpile(code);
  res.json({ compiled, original: code });
});

// ========== SERVE SPA ==========
app.get('*', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`FlowCode running on port ${PORT}`);
});
