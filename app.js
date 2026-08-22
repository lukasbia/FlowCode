// ===== FlowCode Frontend =====

const API = {
  async get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async post(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async put(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async del(url) {
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }
};

// ===== State =====
const state = {
  user: null,
  bots: [],
  currentBot: null,
  scripts: [],
  variables: [],
  currentScript: null,
  view: 'bots',
  previousView: null
};

// ===== DOM Elements =====
const els = {
  loginScreen: document.getElementById('login-screen'),
  mainApp: document.getElementById('main-app'),
  pageTitle: document.getElementById('page-title'),
  backBtn: document.getElementById('back-btn'),
  content: document.getElementById('content'),
  bottomNav: document.getElementById('bottom-nav'),
  fabAddBot: document.getElementById('fab-add-bot'),
  fabAddVar: document.getElementById('fab-add-variable'),
  fabAddScript: document.getElementById('fab-add-script'),

  // Views
  botListView: document.getElementById('bot-list-view'),
  dashboardView: document.getElementById('dashboard-view'),
  flowcodeListView: document.getElementById('flowcode-list-view'),
  codeEditorView: document.getElementById('code-editor-view'),
  variablesView: document.getElementById('variables-view'),

  // Containers
  botsContainer: document.getElementById('bots-container'),
  emptyBots: document.getElementById('empty-bots'),
  scriptsContainer: document.getElementById('scripts-container'),
  emptyScripts: document.getElementById('empty-scripts'),
  variablesContainer: document.getElementById('variables-container'),
  emptyVariables: document.getElementById('empty-variables'),

  // Dashboard
  dashAvatar: document.getElementById('dash-avatar'),
  dashName: document.getElementById('dash-name'),
  dashStatus: document.getElementById('dash-status'),
  publishBtn: document.getElementById('publish-btn'),

  // Code Editor
  codeName: document.getElementById('code-name'),
  codeTrigger: document.getElementById('code-trigger'),
  codeEditor: document.getElementById('code-editor'),
  codeHighlight: document.getElementById('code-highlight'),
  lineNumbers: document.getElementById('line-numbers'),
  charCount: document.getElementById('char-count'),
  lineCount: document.getElementById('line-count'),
  triggerWarning: document.getElementById('trigger-warning'),
  saveCodeBtn: document.getElementById('save-code-btn'),

  // Modals
  addBotModal: document.getElementById('add-bot-modal'),
  addVarModal: document.getElementById('add-variable-modal'),
  addScriptModal: document.getElementById('add-script-modal'),
  botNameInput: document.getElementById('bot-name-input'),
  botTokenInput: document.getElementById('bot-token-input'),
  varNameInput: document.getElementById('var-name-input'),
  varValueInput: document.getElementById('var-value-input'),
  scriptNameInput: document.getElementById('script-name-input'),
  scriptTriggerInput: document.getElementById('script-trigger-input'),

  // Toast
  toast: document.getElementById('toast'),
  toastMessage: document.getElementById('toast-message'),
  loading: document.getElementById('loading')
};

// ===== FlowCode Syntax Highlighter =====
const FlowCodeHighlighter = {
  keywords: ['if','else','while','for','switch','case','default','break','continue','return','try','catch','function','var','let','const','async','await','new','this','true','false','null','undefined'],
  systemTypes: ['Discord','UI','Math','Logic','Flow','Text','Time','Network','Database','FileSystem','Audio','System'],
  functions: [],

  init() {
    // Extract function names from the function list
    const funcPattern = /\b([A-Za-z]+)\.([A-Za-z]+)\(/g;
    // Common FlowScript functions based on the provided list
    this.functions = [
      'abs','activity','addButton','addCmdReactions','add','addField','addReactions','addRole','addSelectMenu',
      'addSelectMenuOption','addTextInput','advancedFooter','advancedTitle','allMembersCount','alwaysReply',
      'and','anonymous','answerCallback','answer','api','apiData','argsCount','async','attachment','author',
      'icon','id','mention','name','pfp','url','autoDelete','awaitReaction','awaitFunc','awaitMessages',
      'awaitReactions','ban','banCount','bans','base64Decode','base64Encode','blacklist','leave','leaveGuild',
      'listDescription','listHide','listUnlist','node','ownerID','ping','prefix','break','calculate',
      'calculateBitwiseAnd','calculateBitwiseNot','calculateBitwiseOr','calculateBitwiseXor','callFunc',
      'case','categoryChannels','categoryCount','categoryID','categoryName','changeUsername','changeUsernameWithPassword',
      'channelCount','exists','nsfw','overwrites','position','slowmode','topic','type','charCount','checkCondition',
      'clear','clearReactions','clone','close','color','info','perms','cooldownTime','createCategory','create',
      'createCollection','createDirectory','createFile','createPost','create','create','create','create','create',
      'date','day','djsEval','decision','default','defer','deferUpdate','deleteButton','deleteCategory','delete',
      'deleteMessage','deleteDirectory','deleteFile','deleteIn','delete','delete','delete','delete','delete','delete',
      'deleteVar','delete','description','disableMention','disableSpecialPrefixe','discount','dm','downloadFile',
      'editButton','edit','editMedia','editIn','edit','editField','edit','editSelectMenu','editSelectMenuOption',
      'edit','edit','edit','edit','embed','author','authorIcon','authorName','authorUrl','setColor','setDescription',
      'field','fieldCount','fieldName','fieldValue','footer','footerIcon','footerText','image','setImage','thumbnail',
      'setThumbnail','title','setTitle','url','count','exists','id','name','url','enableSpecialPrefixe','endAsync',
      'endExecution','endIf','endLoop','endSwitch','endTry','ephemeral','error','errorMsg','eval','executionTime',
      'exit','file','fileExists','find','findList','findMembers','findNumbers','find','find','footer','footerIcon',
      'footerText','for','forEach','channelCount','postCount','get','getInfo','getInvite','get','getCooldownTime',
      'getCustomStatus','getData','getGlobal','getInfo','get','getReactions','get','getObject','getObjectProperty',
      'getPruneCount','get','getSelectMenuValues','get','getID','getSlowmode','getInfo','getSubcommand','getSubcommandGroup',
      'getTextSplitLength','getActivity','getBadges','getBanner','getColor','getPerms','getStatus','get','getVar',
      'getInfo','globalUser','globalExists','boostCount','boostLevel','count','exists','icon','id','leave','name',
      'ownerID','vanityURL','hasEmbeds','hasPerms','hasRole','hasSuffix','head','highestRole','history','hour',
      'httpGet','httpHeader','httpPost','httpResult','httpResult','httpStatus','if','ignoreTriggerCase','image',
      'includes','includesWord','indexOf','input','code','count','url','isAnimated','isBot','isBanned','isCustom',
      'isDirectory','isFile','isHoisted','isMentionable','isNaN','isNumber','isOnline','isPending','isSlash',
      'isSoundboardButton','isSystemMessage','isTimedOut','isDM','isDM','isVariableExist','isVip','join','joinVC',
      'jsonParse','jsonRequest','kick','kickMention','language','lastMessageID','leaveChannel','leaveVC','log',
      'loop','lowerCase','makeArray','max','exists','membersCount','getMembersCount','mention','content','attachment',
      'id','link','slice','type','url','min','minute','modifyPerms','modifyPerms','moduleExists','modulo','month',
      'move','move','multi','mute','naturalJoin','negate','nowPlaying','numberSeparator','or','ordinal','otherwise',
      'pause','play','playlist','presence','position','permissions','pin','pin','pause','play','playlist','presence',
      'position','permissions','react','region','removeRole','repeat','reply','resetNickname','roleCount','icon',
      'id','mention','name','color','resume','round','random','sum','send','set','setSlowmode','setObject','setVar',
      'seek','setName','setNickname','shuffle','sqrt','stop','split','switch','systemInfo','timestamp','topic',
      'titleCase','translate','try','trigger','upperCase','unpin','volume','volume','voiceChannel','version','verify',
      'wait','wordCount','while','send','wait','wordCount','while','send'
    ];
  },

  highlight(code) {
    let html = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Comments
    html = html.replace(/(\/\/.*$|\/\*[\s\S]*?\*\/)/gm, '<span class="hljs-comment">$1</span>');

    // Strings
    html = html.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, '<span class="hljs-string">$1</span>');

    // Numbers and booleans
    html = html.replace(/\b(\d+(?:\.\d+)?|true|false|null|undefined)\b/g, '<span class="hljs-number">$1</span>');

    // System types (Category prefixes)
    html = html.replace(/\b(Discord|UI|Math|Logic|Flow|Text|Time|Network|Database|FileSystem|Audio|System)\b/g, '<span class="hljs-system">$1</span>');

    // Functions
    const funcRegex = new RegExp('\\b(' + this.functions.join('|') + ')\\b', 'g');
    html = html.replace(funcRegex, '<span class="hljs-function">$1</span>');

    // Keywords
    const kwRegex = new RegExp('\\b(' + this.keywords.join('|') + ')\\b', 'g');
    html = html.replace(kwRegex, '<span class="hljs-keyword">$1</span>');

    return html;
  }
};

FlowCodeHighlighter.init();

// ===== Toast =====
function showToast(msg, duration = 2500) {
  els.toastMessage.textContent = msg;
  els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), duration);
}

// ===== Loading =====
function setLoading(show) {
  els.loading.classList.toggle('hidden', !show);
}

// ===== Navigation =====
const views = {
  bots: { el: els.botListView, title: 'My Bots', fab: 'bot', nav: 'bots' },
  dashboard: { el: els.dashboardView, title: 'Dashboard', fab: null, nav: 'dashboard' },
  flowcode: { el: els.flowcodeListView, title: 'FlowCode', fab: 'script', nav: 'flowcode' },
  variables: { el: els.variablesView, title: 'Variables', fab: 'var', nav: 'variables' },
  editor: { el: els.codeEditorView, title: 'Editor', fab: null, nav: null }
};

function showView(viewName, isSubView = false) {
  const view = views[viewName];
  if (!view) return;

  if (!isSubView) {
    state.previousView = state.view;
    state.view = viewName;
  }

  // Hide all views
  Object.values(views).forEach(v => v.el.classList.add('hidden'));
  view.el.classList.remove('hidden');

  // Update header
  els.pageTitle.textContent = view.title;
  els.backBtn.classList.toggle('hidden', !isSubView && viewName === 'bots');

  // Update FAB
  els.fabAddBot.classList.add('hidden');
  els.fabAddVar.classList.add('hidden');
  els.fabAddScript.classList.add('hidden');
  if (view.fab === 'bot') els.fabAddBot.classList.remove('hidden');
  if (view.fab === 'var') els.fabAddVar.classList.remove('hidden');
  if (view.fab === 'script') els.fabAddScript.classList.remove('hidden');

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view.nav);
  });
  els.bottomNav.classList.toggle('hidden', viewName === 'editor' || !state.currentBot);

  // Scroll to top
  els.content.scrollTop = 0;
}

els.backBtn.addEventListener('click', () => {
  if (state.view === 'editor') {
    showView('flowcode');
  } else if (state.currentBot) {
    showView('bots');
    state.currentBot = null;
  }
});

// Nav items
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    if (view === 'bots') {
      state.currentBot = null;
      showView('bots');
    } else if (state.currentBot) {
      showView(view);
    } else {
      showToast('Select a bot first');
    }
  });
});

// ===== Auth =====
async function checkAuth() {
  try {
    setLoading(true);
    const user = await API.get('/api/me');
    if (user) {
      state.user = user;
      els.loginScreen.classList.add('hidden');
      els.mainApp.classList.remove('hidden');
      await loadBots();
      showView('bots');
    } else {
      els.loginScreen.classList.remove('hidden');
      els.mainApp.classList.add('hidden');
    }
  } catch (e) {
    els.loginScreen.classList.remove('hidden');
    els.mainApp.classList.add('hidden');
  } finally {
    setLoading(false);
  }
}

// ===== Bots =====
async function loadBots() {
  try {
    state.bots = await API.get('/api/bots');
    renderBots();
  } catch (e) {
    showToast('Failed to load bots');
  }
}

function renderBots() {
  els.botsContainer.innerHTML = '';

  if (state.bots.length === 0) {
    els.emptyBots.classList.remove('hidden');
    return;
  }
  els.emptyBots.classList.add('hidden');

  state.bots.forEach(bot => {
    const card = document.createElement('div');
    card.className = 'bot-card';
    card.innerHTML = `
      <img class="bot-avatar" src="${bot.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png'}" alt="">
      <span class="bot-name">${escapeHtml(bot.name)}</span>
      <span class="bot-status-dot ${bot.is_published ? 'published' : ''}"></span>
    `;

    // Long press for delete
    let pressTimer;
    card.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => showDeleteConfirm(card, bot), 800);
    });
    card.addEventListener('touchend', () => clearTimeout(pressTimer));
    card.addEventListener('touchmove', () => clearTimeout(pressTimer));

    card.addEventListener('click', () => selectBot(bot));
    els.botsContainer.appendChild(card);
  });
}

function showDeleteConfirm(card, bot) {
  const confirm = document.createElement('div');
  confirm.className = 'delete-confirm';
  confirm.innerHTML = `
    <p>Delete ${escapeHtml(bot.name)}?</p>
    <div class="delete-actions">
      <button class="cancel-del">Cancel</button>
      <button class="confirm-delete">Delete</button>
    </div>
  `;
  card.appendChild(confirm);

  confirm.querySelector('.cancel-del').addEventListener('click', (e) => {
    e.stopPropagation();
    confirm.remove();
  });
  confirm.querySelector('.confirm-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      setLoading(true);
      await API.del(`/api/bots/${bot.id}`);
      await loadBots();
      showToast('Bot deleted');
    } catch (err) {
      showToast('Failed to delete bot');
    } finally {
      setLoading(false);
    }
  });
}

function selectBot(bot) {
  state.currentBot = bot;
  // Update dashboard
  els.dashAvatar.src = bot.avatar_url || 'https://cdn.discordapp.com/embed/avatars/0.png';
  els.dashName.textContent = bot.name;
  els.dashStatus.textContent = bot.is_published ? 'Published' : 'Draft';
  els.dashStatus.classList.toggle('published', bot.is_published);
  els.publishBtn.disabled = bot.is_published;

  showView('dashboard');
  loadScripts();
  loadVariables();
}

// Add Bot Modal
els.fabAddBot.addEventListener('click', () => {
  if (state.bots.length >= 3) {
    showToast('Maximum 3 bots per account');
    return;
  }
  els.addBotModal.classList.remove('hidden');
  els.botNameInput.value = '';
  els.botTokenInput.value = '';
});

document.getElementById('cancel-add-bot').addEventListener('click', () => {
  els.addBotModal.classList.add('hidden');
});

document.getElementById('confirm-add-bot').addEventListener('click', async () => {
  const name = els.botNameInput.value.trim();
  const token = els.botTokenInput.value.trim();

  if (!name || !token) {
    showToast('Please fill in all fields');
    return;
  }

  try {
    setLoading(true);
    await API.post('/api/bots', { name, token });
    els.addBotModal.classList.add('hidden');
    await loadBots();
    showToast('Bot added successfully');
  } catch (err) {
    showToast(err.message || 'Failed to add bot');
  } finally {
    setLoading(false);
  }
});

// Publish
els.publishBtn.addEventListener('click', async () => {
  if (!state.currentBot) return;
  try {
    setLoading(true);
    const res = await API.post(`/api/bots/${state.currentBot.id}/publish`);
    showToast(res.message || 'Publishing scheduled');
    els.publishBtn.disabled = true;
  } catch (err) {
    showToast(err.message || 'Publish failed');
  } finally {
    setLoading(false);
  }
});

// ===== Scripts =====
async function loadScripts() {
  if (!state.currentBot) return;
  try {
    state.scripts = await API.get(`/api/bots/${state.currentBot.id}/scripts`);
    renderScripts();
  } catch (e) {
    showToast('Failed to load scripts');
  }
}

function renderScripts() {
  els.scriptsContainer.innerHTML = '';

  if (state.scripts.length === 0) {
    els.emptyScripts.classList.remove('hidden');
    return;
  }
  els.emptyScripts.classList.add('hidden');

  state.scripts.forEach(script => {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.innerHTML = `
      <span class="script-name">${escapeHtml(script.name)}</span>
      <span class="script-trigger">
        <span class="trigger-tag">${escapeHtml(script.trigger)}</span>
      </span>
    `;
    card.addEventListener('click', () => openEditor(script));
    els.scriptsContainer.appendChild(card);
  });
}

// Add Script Modal
els.fabAddScript.addEventListener('click', () => {
  els.addScriptModal.classList.remove('hidden');
  els.scriptNameInput.value = '';
  els.scriptTriggerInput.value = 'ready';
});

document.getElementById('cancel-add-script').addEventListener('click', () => {
  els.addScriptModal.classList.add('hidden');
});

document.getElementById('confirm-add-script').addEventListener('click', async () => {
  const name = els.scriptNameInput.value.trim();
  const trigger = els.scriptTriggerInput.value;

  if (!name) {
    showToast('Please enter a script name');
    return;
  }

  try {
    setLoading(true);
    const script = await API.post(`/api/bots/${state.currentBot.id}/scripts`, { name, trigger });
    els.addScriptModal.classList.add('hidden');
    await loadScripts();
    openEditor(script);
  } catch (err) {
    showToast(err.message || 'Failed to create script');
  } finally {
    setLoading(false);
  }
});

// ===== Code Editor =====
function openEditor(script) {
  state.currentScript = script;
  els.codeName.value = script.name;
  els.codeTrigger.value = script.trigger;
  els.codeEditor.value = script.code || '';
  updateEditorStats();
  highlightCode();
  showView('editor', true);
}

function updateEditorStats() {
  const code = els.codeEditor.value;
  els.charCount.textContent = `${code.length} chars`;
  els.lineCount.textContent = `${code.split('\n').length} lines`;

  // Update line numbers
  const lines = code.split('\n').length;
  els.lineNumbers.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('\n');
}

function highlightCode() {
  const code = els.codeEditor.value;
  els.codeHighlight.innerHTML = FlowCodeHighlighter.highlight(code);
}

els.codeEditor.addEventListener('input', () => {
  updateEditorStats();
  highlightCode();
});

els.codeEditor.addEventListener('scroll', () => {
  els.codeHighlight.scrollTop = els.codeEditor.scrollTop;
  els.codeHighlight.scrollLeft = els.codeEditor.scrollLeft;
  els.lineNumbers.scrollTop = els.codeEditor.scrollTop;
});

els.codeEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = els.codeEditor.selectionStart;
    const end = els.codeEditor.selectionEnd;
    els.codeEditor.value = els.codeEditor.value.substring(0, start) + '    ' + els.codeEditor.value.substring(end);
    els.codeEditor.selectionStart = els.codeEditor.selectionEnd = start + 4;
    updateEditorStats();
    highlightCode();
  }
});

els.codeTrigger.addEventListener('change', () => {
  const validTriggers = ['ready','memberJoin','memberLeave','memberBan','memberUnban','messageDelete','messageUpdate','reactionAdd','reactionRemove','channelCreate','channelDelete','voiceUpdate'];
  els.triggerWarning.classList.toggle('hidden', validTriggers.includes(els.codeTrigger.value));
});

els.saveCodeBtn.addEventListener('click', async () => {
  if (!state.currentScript || !state.currentBot) return;

  const name = els.codeName.value.trim();
  const trigger = els.codeTrigger.value;
  const code = els.codeEditor.value;

  if (!name) {
    showToast('Please enter a script name');
    return;
  }

  try {
    setLoading(true);

    // Compile to JS
    const compileRes = await API.post('/api/compile', { code });

    await API.put(`/api/bots/${state.currentBot.id}/scripts/${state.currentScript.id}`, {
      name, trigger, code
    });

    showToast('Code saved & compiled');
    await loadScripts();
    showView('flowcode');
  } catch (err) {
    showToast(err.message || 'Failed to save');
  } finally {
    setLoading(false);
  }
});

// ===== Variables =====
async function loadVariables() {
  if (!state.currentBot) return;
  try {
    state.variables = await API.get(`/api/bots/${state.currentBot.id}/variables`);
    renderVariables();
  } catch (e) {
    showToast('Failed to load variables');
  }
}

function renderVariables() {
  els.variablesContainer.innerHTML = '';

  if (state.variables.length === 0) {
    els.emptyVariables.classList.remove('hidden');
    return;
  }
  els.emptyVariables.classList.add('hidden');

  state.variables.forEach(variable => {
    const card = document.createElement('div');
    card.className = 'variable-card';
    card.innerHTML = `
      <div class="var-info">
        <span class="var-name">${escapeHtml(variable.name)}</span>
        <span class="var-value">${escapeHtml(variable.current_value || '(empty)')}</span>
      </div>
      <div class="var-actions">
        <button class="var-btn edit-var" data-id="${variable.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="var-btn delete-var" data-id="${variable.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    card.querySelector('.delete-var').addEventListener('click', async () => {
      try {
        setLoading(true);
        await API.del(`/api/bots/${state.currentBot.id}/variables/${variable.id}`);
        await loadVariables();
        showToast('Variable deleted');
      } catch (err) {
        showToast('Failed to delete');
      } finally {
        setLoading(false);
      }
    });

    els.variablesContainer.appendChild(card);
  });
}

// Add Variable Modal
els.fabAddVar.addEventListener('click', () => {
  els.addVarModal.classList.remove('hidden');
  els.varNameInput.value = '';
  els.varValueInput.value = '';
});

document.getElementById('cancel-add-var').addEventListener('click', () => {
  els.addVarModal.classList.add('hidden');
});

document.getElementById('confirm-add-var').addEventListener('click', async () => {
  const name = els.varNameInput.value.trim();
  const current_value = els.varValueInput.value.trim();

  if (!name) {
    showToast('Please enter a variable name');
    return;
  }

  try {
    setLoading(true);
    await API.post(`/api/bots/${state.currentBot.id}/variables`, { name, current_value });
    els.addVarModal.classList.add('hidden');
    await loadVariables();
    showToast('Variable added');
  } catch (err) {
    showToast(err.message || 'Failed to add variable');
  } finally {
    setLoading(false);
  }
});

// ===== Modals Close on Overlay Click =====
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', () => {
    overlay.parentElement.classList.add('hidden');
  });
});

// ===== Utilities =====
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ===== Init =====
checkAuth();
