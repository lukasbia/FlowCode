/**
 * FlowPlayground — Main Application
 * With Strict Validator + Supabase Global Marketplace
 */

const STORAGE_KEY = 'flowplayground_projects';
const DEFAULT_CODE = `// Welcome to FlowScript!
// This is your game code. Build something amazing.

<fs core.start>
<fs variables.set(_:"score" value:0)>
<fs sprite.set(_:"hero" x:196 y:400 width:64 height:64 color:"#0a84ff")>
<fs physics.setGravity(x:0 y:500)>
<fs core.end>

<fs core.update>
<fs input.getAxis(_:"move")>
<fs motion.applyForce(_:"hero" x:move.x*500 y:0)>
<fs input.justPressed(_:"Space")>
<fs motion.applyImpulse(_:"hero" y:-300)>
<fs core.end>

<fs core.update>
<fs sprite.set(_:"enemy" x:300 y:700 width:50 height:50 color:"#ff453a")>
<fs core.end>`;

class FlowPlayground {
    constructor() {
        this.projects = [];
        this.currentProject = null;
        this.currentView = 'home';
        this.runtime = null;
        this.playerRuntime = null;
        this.validator = new FlowValidator();
        this.supabase = new FlowSupabase();
        this.pendingValidation = null;

        this.init();
    }

    async init() {
        this.loadProjects();
        this.setupEventListeners();
        this.setupEditor();
        this.renderHome();
        await this.renderMarketplace();
    }

    /* ========================
       STORAGE
       ======================== */

    loadProjects() {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            this.projects = data ? JSON.parse(data) : [];
        } catch (e) {
            this.projects = [];
        }
    }

    saveProjects() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.projects));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }

    createProject(name, genre, subgenre) {
        const project = {
            id: this.generateId(),
            name: name || 'Untitled Project',
            genre: genre || 'Action',
            subgenre: subgenre || 'Platformer',
            code: DEFAULT_CODE,
            sprites: [],
            isPublic: false,
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.projects.unshift(project);
        this.saveProjects();
        return project;
    }

    updateProject(id, updates) {
        const idx = this.projects.findIndex(p => p.id === id);
        if (idx >= 0) {
            this.projects[idx] = { ...this.projects[idx], ...updates, updatedAt: Date.now() };
            this.saveProjects();
        }
    }

    deleteProject(id) {
        this.projects = this.projects.filter(p => p.id !== id);
        this.saveProjects();
    }

    getProject(id) {
        return this.projects.find(p => p.id === id);
    }

    /* ========================
       NAVIGATION
       ======================== */

    showView(viewName) {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(`view-${viewName}`)?.classList.add('active');

        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        if (viewName === 'home') document.getElementById('nav-home')?.classList.add('active');
        if (viewName === 'marketplace') document.getElementById('nav-marketplace')?.classList.add('active');

        this.currentView = viewName;
    }

    /* ========================
       HOME VIEW
       ======================== */

    renderHome() {
        const list = document.getElementById('projects-list');
        const count = document.getElementById('project-count');
        const section = document.getElementById('recent-projects-section');

        if (count) count.textContent = `${this.projects.length} project${this.projects.length !== 1 ? 's' : ''}`;

        if (this.projects.length === 0) {
            if (section) section.style.display = 'none';
            if (list) list.innerHTML = '';
            return;
        }

        if (section) section.style.display = 'block';

        if (list) {
            list.innerHTML = this.projects.map(p => `
                <div class="project-card" data-id="${p.id}">
                    <div class="project-card-header">
                        <div>
                            <div class="project-card-title">${this.escapeHtml(p.name)}</div>
                            <div class="project-card-meta">${this.escapeHtml(p.genre)} • ${this.escapeHtml(p.subgenre)}</div>
                        </div>
                        <span class="project-card-badge ${p.isPublic ? 'badge-public' : 'badge-private'}">
                            ${p.isPublic ? 'Public' : 'Private'}
                        </span>
                    </div>
                    <div class="project-card-footer">
                        <span>${this.formatDate(p.updatedAt)}</span>
                        <div class="project-card-actions">
                            <button class="btn-edit" data-id="${p.id}" title="Edit">✏️</button>
                            <button class="btn-delete" data-id="${p.id}" title="Delete">🗑️</button>
                        </div>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.project-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.project-card-actions')) return;
                    this.openProject(card.dataset.id);
                });
            });

            list.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openProject(btn.dataset.id);
                });
            });

            list.querySelectorAll('.btn-delete').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm('Delete this project? This cannot be undone.')) {
                        this.deleteProject(btn.dataset.id);
                        this.renderHome();
                        this.showToast('Project deleted', 'info');
                    }
                });
            });
        }
    }

    /* ========================
       EDITOR VIEW
       ======================== */

    openProject(id) {
        const project = this.getProject(id);
        if (!project) return;

        this.currentProject = project;

        document.getElementById('project-title').textContent = project.name;
        document.getElementById('project-meta').textContent = `${project.genre} • ${project.subgenre}`;
        document.getElementById('code-editor').value = project.code;

        this.updatePublicToggle(project.isPublic);
        this.updateCodeStats();
        this.renderSprites();

        this.stopEmulator();
        document.getElementById('emulator-overlay').classList.remove('hidden');

        this.showView('editor');
        this.updateLineNumbers();
    }

    updatePublicToggle(isPublic) {
        const btn = document.getElementById('btn-toggle-public');
        if (!btn) return;

        if (isPublic) {
            btn.classList.remove('toggle-private');
            btn.classList.add('toggle-public');
            btn.innerHTML = '<span class="toggle-icon">🌐</span><span class="toggle-text">Public</span>';
        } else {
            btn.classList.remove('toggle-public');
            btn.classList.add('toggle-private');
            btn.innerHTML = '<span class="toggle-icon">🔒</span><span class="toggle-text">Private</span>';
        }
    }

    saveCurrentProject() {
        if (!this.currentProject) return;

        const code = document.getElementById('code-editor').value;
        this.updateProject(this.currentProject.id, { code });
        this.showToast('Project saved locally', 'success');
    }

    async togglePublic() {
        if (!this.currentProject) return;

        const newState = !this.currentProject.isPublic;

        if (newState) {
            // STRICT VALIDATION BEFORE PUBLISHING
            await this.runValidationAndPublish();
        } else {
            // Unpublish
            this.updateProject(this.currentProject.id, { isPublic: false });
            this.updatePublicToggle(false);

            try {
                await this.supabase.unpublishProject(this.currentProject.id);
            } catch (e) {
                console.log('Unpublish note:', e.message);
            }

            this.showToast('Project is now Private', 'info');
        }
    }

    /* ========================
       STRICT VALIDATION
       ======================== */

    async runValidationAndPublish() {
        const modal = document.getElementById('modal-validation');
        const statusDiv = document.getElementById('validation-status');
        const resultsDiv = document.getElementById('validation-results');
        const scoreDiv = document.getElementById('validation-score');
        const errorsDiv = document.getElementById('validation-errors');
        const warningsDiv = document.getElementById('validation-warnings');
        const footer = document.getElementById('validation-footer');
        const publishBtn = document.getElementById('btn-publish-anyway');
        const fixBtn = document.getElementById('btn-fix-issues');

        // Show modal
        modal.classList.remove('hidden');
        statusDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        publishBtn.classList.add('hidden');
        fixBtn.textContent = 'Fix Issues';

        // Run validation (simulate delay for thoroughness)
        await new Promise(r => setTimeout(r, 800));

        const report = this.validator.validate(this.currentProject);
        this.pendingValidation = report;

        statusDiv.classList.add('hidden');
        resultsDiv.classList.remove('hidden');

        // Score display
        scoreDiv.className = 'validation-score';
        if (report.passed && report.warnings.length === 0) {
            scoreDiv.classList.add('pass');
            scoreDiv.innerHTML = `✅ VALIDATION PASSED<br><span style="font-size:14px;font-weight:500">Quality Score: ${report.score}/100</span>`;
        } else if (report.passed) {
            scoreDiv.classList.add('warn');
            scoreDiv.innerHTML = `⚠️ PASSED WITH WARNINGS<br><span style="font-size:14px;font-weight:500">Quality Score: ${report.score}/100</span>`;
        } else {
            scoreDiv.classList.add('fail');
            scoreDiv.innerHTML = `❌ VALIDATION FAILED<br><span style="font-size:14px;font-weight:500">Quality Score: ${report.score}/100 — ${report.errors.length} critical issue(s)</span>`;
        }

        // Errors
        if (report.errors.length > 0) {
            errorsDiv.innerHTML = '<h4 style="color:var(--accent-red);font-size:13px;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">🚫 Critical Errors (Must Fix)</h4>' +
                report.errors.map(e => `
                    <div class="validation-item error">
                        <div class="validation-item-header">
                            <span>${this.escapeHtml(e.message)}</span>
                            <span class="badge">${e.type}</span>
                        </div>
                        <div class="validation-item-details">${this.escapeHtml(e.details)}</div>
                        <div class="validation-item-fix">${this.escapeHtml(e.fix)}</div>
                    </div>
                `).join('');
        } else {
            errorsDiv.innerHTML = '';
        }

        // Warnings
        if (report.warnings.length > 0) {
            warningsDiv.innerHTML = '<h4 style="color:var(--accent-orange);font-size:13px;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px">⚠️ Warnings (Recommended)</h4>' +
                report.warnings.map(w => `
                    <div class="validation-item warning">
                        <div class="validation-item-header">
                            <span>${this.escapeHtml(w.message)}</span>
                            <span class="badge">${w.type}</span>
                        </div>
                        ${w.details ? `<div class="validation-item-details">${this.escapeHtml(w.details)}</div>` : ''}
                        ${w.fix ? `<div class="validation-item-fix">${this.escapeHtml(w.fix)}</div>` : ''}
                    </div>
                `).join('');
        } else {
            warningsDiv.innerHTML = '';
        }

        // Footer buttons
        if (report.passed) {
            publishBtn.classList.remove('hidden');
            publishBtn.textContent = report.warnings.length > 0 ? 'Publish Anyway' : 'Publish to FlowStore';
            fixBtn.classList.add('hidden');
        } else {
            publishBtn.classList.add('hidden');
            fixBtn.classList.remove('hidden');
            fixBtn.textContent = 'Close & Fix Issues';
        }
    }

    async confirmPublish() {
        const modal = document.getElementById('modal-validation');
        modal.classList.add('hidden');

        // Update local state
        this.updateProject(this.currentProject.id, { isPublic: true });
        this.updatePublicToggle(true);

        // Try to publish to Supabase
        try {
            await this.supabase.publishProject(this.currentProject, this.pendingValidation);
            this.showToast('🌐 Published to global FlowStore!', 'success');
        } catch (e) {
            console.error('Supabase publish failed:', e);
            this.showToast('Published locally. Supabase not connected — check console for setup.', 'warning');
        }

        this.pendingValidation = null;
    }

    /* ========================
       CODE EDITOR
       ======================== */

    setupEditor() {
        const editor = document.getElementById('code-editor');
        const lineNumbers = document.getElementById('line-numbers');

        if (!editor) return;

        editor.addEventListener('input', () => {
            this.updateLineNumbers();
            this.updateCodeStats();
        });

        editor.addEventListener('scroll', () => {
            if (lineNumbers) lineNumbers.scrollTop = editor.scrollTop;
        });

        editor.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = editor.selectionStart;
                const end = editor.selectionEnd;
                editor.value = editor.value.substring(0, start) + '    ' + editor.value.substring(end);
                editor.selectionStart = editor.selectionEnd = start + 4;
                this.updateCodeStats();
            }
        });
    }

    updateLineNumbers() {
        const editor = document.getElementById('code-editor');
        const lineNumbers = document.getElementById('line-numbers');
        if (!editor || !lineNumbers) return;

        const lines = editor.value.split('\n').length;
        lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
    }

    updateCodeStats() {
        const editor = document.getElementById('code-editor');
        if (!editor) return;

        const text = editor.value;
        const lines = text.split('\n').length;
        const chars = text.length;

        document.getElementById('code-lines').textContent = `Lines: ${lines}`;
        document.getElementById('code-chars').textContent = `Chars: ${chars}`;
    }

    /* ========================
       EMULATOR
       ======================== */

    startEmulator() {
        const canvas = document.getElementById('emulator-canvas');
        const code = document.getElementById('code-editor').value;

        if (!canvas) return;

        if (this.currentProject) {
            this.updateProject(this.currentProject.id, { code });
        }

        if (!this.runtime) {
            this.runtime = new FlowRuntime(canvas);
        }

        if (this.currentProject) {
            for (const sprite of this.currentProject.sprites) {
                const img = new Image();
                img.src = sprite.data;
                this.runtime.sprites.set(sprite.name, img);
            }
        }

        this.runtime.compileAndRun(code);

        document.getElementById('btn-play').classList.add('hidden');
        document.getElementById('btn-stop').classList.remove('hidden');
        document.getElementById('emulator-overlay').classList.add('hidden');

        this.showToast('Game running', 'success');
    }

    stopEmulator() {
        if (this.runtime) {
            this.runtime.stop();
        }

        document.getElementById('btn-play').classList.remove('hidden');
        document.getElementById('btn-stop').classList.add('hidden');

        const canvas = document.getElementById('emulator-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    /* ========================
       SPRITES
       ======================== */

    renderSprites() {
        const container = document.getElementById('sprites-list');
        if (!container) return;

        const sprites = this.currentProject?.sprites || [];

        if (sprites.length === 0) {
            container.innerHTML = `
                <div class="sprite-empty" id="sprite-empty">
                    <p>No sprites yet</p>
                    <span>Import images to get started</span>
                </div>
            `;
            return;
        }

        container.innerHTML = sprites.map((s, i) => `
            <div class="sprite-item" data-index="${i}" title="${this.escapeHtml(s.name)}">
                <img src="${s.data}" alt="${this.escapeHtml(s.name)}">
                <span class="sprite-item-name">${this.escapeHtml(s.name)}</span>
                <button class="sprite-item-delete" data-index="${i}">×</button>
            </div>
        `).join('');

        container.querySelectorAll('.sprite-item-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.dataset.index);
                this.currentProject.sprites.splice(idx, 1);
                this.updateProject(this.currentProject.id, { sprites: this.currentProject.sprites });
                this.renderSprites();
            });
        });
    }

    handleSpriteUpload(file) {
        if (!file || !this.currentProject) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const name = file.name.replace(/\.[^/.]+$/, '');
            const width = parseInt(document.getElementById('sprite-width').value) || 64;
            const height = parseInt(document.getElementById('sprite-height').value) || 64;

            this.currentProject.sprites.push({
                name,
                data: e.target.result,
                width,
                height
            });

            this.updateProject(this.currentProject.id, { sprites: this.currentProject.sprites });
            this.renderSprites();
            this.showToast(`Sprite "${name}" imported`, 'success');
        };
        reader.readAsDataURL(file);
    }

    /* ========================
       MARKETPLACE (GLOBAL)
       ======================== */

    async renderMarketplace() {
        const list = document.getElementById('games-list');
        const empty = document.getElementById('marketplace-empty');
        const offline = document.getElementById('marketplace-offline');
        const loading = document.getElementById('marketplace-loading');
        const search = document.getElementById('marketplace-search');

        if (loading) loading.classList.remove('hidden');
        if (list) list.innerHTML = '';
        if (empty) empty.classList.add('hidden');
        if (offline) offline.classList.add('hidden');

        const filter = search?.value?.toLowerCase() || '';
        const activeFilter = document.querySelector('.filter-chip.active')?.dataset.filter || 'all';

        let projects = [];

        try {
            // Try Supabase first (global)
            projects = await this.supabase.fetchPublicProjects(filter, activeFilter);
        } catch (e) {
            console.log('Supabase fetch failed, using local:', e.message);
            // Fallback to local
            projects = this.supabase.getLocalPublicProjects(filter, activeFilter);
        }

        if (loading) loading.classList.add('hidden');

        if (projects.length === 0) {
            if (!this.supabase.isReady()) {
                if (offline) offline.classList.remove('hidden');
            } else {
                if (empty) empty.classList.remove('hidden');
            }
            return;
        }

        if (empty) empty.classList.add('hidden');
        if (offline) offline.classList.add('hidden');

        if (list) {
            list.innerHTML = projects.map(p => `
                <div class="game-card" data-id="${p.id}">
                    <div class="game-thumbnail">
                        ${p.validationScore >= 90 ? '<span class="game-validation">✓ Verified</span>' : ''}
                    </div>
                    <div class="game-info">
                        <div class="game-title">${this.escapeHtml(p.name)}</div>
                        <div class="game-genre">${this.escapeHtml(p.genre)} • ${this.escapeHtml(p.subgenre)}</div>
                        <div class="game-stats">
                            <span class="game-stat">▶ ${p.playCount || 0}</span>
                            <span class="game-stat">❤️ ${p.likeCount || 0}</span>
                            <span class="game-stat">📊 ${p.validationScore || 0}/100</span>
                        </div>
                        <div class="game-footer">
                            <span class="game-author">${this.escapeHtml(p.authorName || 'Anonymous')}</span>
                            <button class="game-play-btn" data-id="${p.id}">Play</button>
                        </div>
                    </div>
                </div>
            `).join('');

            list.querySelectorAll('.game-play-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.openPlayer(btn.dataset.id);
                });
            });

            list.querySelectorAll('.game-card').forEach(card => {
                card.addEventListener('click', () => {
                    this.openPlayer(card.dataset.id);
                });
            });
        }
    }

    /* ========================
       PLAYER MODAL
       ======================== */

    async openPlayer(projectId) {
        let project = this.getProject(projectId);

        // If not in local, try Supabase
        if (!project && this.supabase.isReady()) {
            try {
                project = await this.supabase.fetchProjectById(projectId);
            } catch (e) {
                console.error('Failed to fetch project:', e);
            }
        }

        if (!project) {
            this.showToast('Game not found', 'error');
            return;
        }

        document.getElementById('player-title').textContent = project.name;
        document.getElementById('player-genre').textContent = `${project.genre} • ${project.subgenre}`;

        const modal = document.getElementById('modal-player');
        modal.classList.remove('hidden');

        const playBtn = document.getElementById('btn-player-play');
        const overlay = document.getElementById('player-overlay');

        playBtn.onclick = () => {
            this.startPlayer(project);
            overlay.classList.add('hidden');

            // Increment play count
            if (this.supabase.isReady()) {
                this.supabase.incrementPlayCount(projectId).catch(() => {});
            }
        };

        overlay.onclick = () => {
            this.startPlayer(project);
            overlay.classList.add('hidden');
        };

        overlay.classList.remove('hidden');
    }

    startPlayer(project) {
        const canvas = document.getElementById('player-canvas');
        if (!canvas) return;

        if (this.playerRuntime) {
            this.playerRuntime.stop();
        }

        this.playerRuntime = new FlowRuntime(canvas);

        for (const sprite of (project.sprites || [])) {
            const img = new Image();
            img.src = sprite.data;
            this.playerRuntime.sprites.set(sprite.name, img);
        }

        this.playerRuntime.compileAndRun(project.code);
    }

    closePlayer() {
        if (this.playerRuntime) {
            this.playerRuntime.stop();
        }
        document.getElementById('modal-player').classList.add('hidden');
    }

    /* ========================
       EVENT LISTENERS
       ======================== */

    setupEventListeners() {
        // Navigation
        document.getElementById('nav-home')?.addEventListener('click', () => {
            this.stopEmulator();
            this.showView('home');
            this.renderHome();
        });

        document.getElementById('nav-marketplace')?.addEventListener('click', async () => {
            this.stopEmulator();
            this.showView('marketplace');
            await this.renderMarketplace();
        });

        // Home buttons
        document.getElementById('btn-new-project')?.addEventListener('click', () => {
            document.getElementById('modal-new-project').classList.remove('hidden');
            document.getElementById('project-name').focus();
        });

        document.getElementById('btn-existing-project')?.addEventListener('click', () => {
            if (this.projects.length === 0) {
                this.showToast('No projects yet. Create one first!', 'info');
            } else {
                document.getElementById('recent-projects-section').scrollIntoView({ behavior: 'smooth' });
            }
        });

        // New Project Modal
        document.getElementById('btn-create-project')?.addEventListener('click', () => this.createNewProject());
        document.getElementById('btn-cancel-project')?.addEventListener('click', () => this.closeModal());
        document.getElementById('btn-cancel-project-2')?.addEventListener('click', () => this.closeModal());

        document.getElementById('modal-new-project')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-new-project')) this.closeModal();
        });

        document.getElementById('project-subgenre')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.createNewProject();
        });

        // Validation Modal
        document.getElementById('btn-close-validation')?.addEventListener('click', () => {
            document.getElementById('modal-validation').classList.add('hidden');
        });

        document.getElementById('btn-publish-anyway')?.addEventListener('click', () => {
            this.confirmPublish();
        });

        document.getElementById('btn-fix-issues')?.addEventListener('click', () => {
            document.getElementById('modal-validation').classList.add('hidden');
        });

        document.getElementById('modal-validation')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-validation')) {
                document.getElementById('modal-validation').classList.add('hidden');
            }
        });

        // Editor toolbar
        document.getElementById('btn-back')?.addEventListener('click', () => {
            this.stopEmulator();
            this.showView('home');
            this.renderHome();
        });

        document.getElementById('btn-play')?.addEventListener('click', () => this.startEmulator());
        document.getElementById('btn-stop')?.addEventListener('click', () => this.stopEmulator());
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveCurrentProject());
        document.getElementById('btn-toggle-public')?.addEventListener('click', () => this.togglePublic());

        // Emulator overlay
        document.getElementById('emulator-overlay')?.addEventListener('click', () => {
            this.startEmulator();
        });

        // Sprite upload
        document.getElementById('btn-upload-sprite')?.addEventListener('click', () => {
            document.getElementById('sprite-upload').click();
        });

        document.getElementById('sprite-upload')?.addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.handleSpriteUpload(e.target.files[0]);
                e.target.value = '';
            }
        });

        // Player modal
        document.getElementById('btn-close-player')?.addEventListener('click', () => this.closePlayer());
        document.getElementById('modal-player')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('modal-player')) this.closePlayer();
        });

        // Marketplace search
        document.getElementById('marketplace-search')?.addEventListener('input', () => {
            this.renderMarketplace();
        });

        // Marketplace filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.renderMarketplace();
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (this.currentView === 'editor') {
                    this.saveCurrentProject();
                }
            }
        });
    }

    createNewProject() {
        const name = document.getElementById('project-name').value.trim();
        const genre = document.getElementById('project-genre').value.trim() || 'Action';
        const subgenre = document.getElementById('project-subgenre').value.trim() || 'Platformer';

        if (!name) {
            this.showToast('Please enter a project name', 'error');
            return;
        }

        const project = this.createProject(name, genre, subgenre);
        this.closeModal();
        this.openProject(project.id);
        this.showToast(`Project "${name}" created`, 'success');

        document.getElementById('project-name').value = '';
        document.getElementById('project-genre').value = '';
        document.getElementById('project-subgenre').value = '';
    }

    closeModal() {
        document.getElementById('modal-new-project').classList.add('hidden');
    }

    /* ========================
       TOASTS
       ======================== */

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /* ========================
       UTILITIES
       ======================== */

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new FlowPlayground();
});
