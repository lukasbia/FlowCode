/**
 * FlowCompiler & FlowRuntime
 * Parses FlowScript and executes it on a Canvas-based runtime
 */

class FlowParser {
    static parse(code) {
        const lines = code.split('\n');
        const commands = [];
        let lineNum = 0;

        for (let rawLine of lines) {
            lineNum++;
            const line = rawLine.trim();
            if (!line || line.startsWith('//')) continue;

            const match = line.match(/<fs\s+([^(>\s]+)(?:\((.*?)\))?\s*(.*?)>/);
            if (!match) {
                const altMatch = line.match(/<fs\s+([^(>\s]+)\s+(.*?)>/);
                if (altMatch) {
                    const name = altMatch[1].trim();
                    const argsStr = altMatch[2].trim();
                    const args = this.parseArgs(argsStr);
                    commands.push({ name, args, line: lineNum, raw: line });
                }
                continue;
            }

            const name = match[1].trim();
            const argsStr = match[2] || match[3] || '';
            const args = this.parseArgs(argsStr);
            commands.push({ name, args, line: lineNum, raw: line });
        }

        return commands;
    }

    static parseArgs(str) {
        const args = {};
        if (!str.trim()) return args;

        const regex = /([\w_]+):\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^,\s][^,]*)/g;
        let m;
        while ((m = regex.exec(str)) !== null) {
            let val = m[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || 
                (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
            } else if (!isNaN(val) && val !== '') {
                val = Number(val);
            } else if (val === 'true') val = true;
            else if (val === 'false') val = false;
            else if (val === 'null' || val === 'nil') val = null;

            args[m[1]] = val;
        }

        return args;
    }
}

class FlowNode {
    constructor(name, type = 'sprite') {
        this.name = name;
        this.type = type;
        this.x = 0;
        this.y = 0;
        this.width = 64;
        this.height = 64;
        this.rotation = 0;
        this.scaleX = 1;
        this.scaleY = 1;
        this.texture = null;
        this.color = null;
        this.alpha = 1;
        this.visible = true;
        this.children = [];
        this.parent = null;
        this.vx = 0;
        this.vy = 0;
        this.angularVelocity = 0;
        this.physics = { enabled: false, restitution: 0.5, friction: 0.3, mass: 1 };
        this.actions = [];
        this.zIndex = 0;
        this.flipX = false;
        this.flipY = false;
        this.text = '';
        this.fontSize = 16;
        this.textColor = '#ffffff';
    }

    addChild(child) {
        if (child.parent) child.removeFromParent();
        child.parent = this;
        this.children.push(child);
        this.children.sort((a, b) => a.zIndex - b.zIndex);
    }

    removeFromParent() {
        if (this.parent) {
            const idx = this.parent.children.indexOf(this);
            if (idx >= 0) this.parent.children.splice(idx, 1);
            this.parent = null;
        }
    }

    getGlobalTransform() {
        let x = this.x;
        let y = this.y;
        let rot = this.rotation;
        let sx = this.scaleX;
        let sy = this.scaleY;

        let node = this.parent;
        while (node) {
            const cos = Math.cos(node.rotation);
            const sin = Math.sin(node.rotation);
            const rx = x * cos - y * sin;
            const ry = x * sin + y * cos;
            x = node.x + rx;
            y = node.y + ry;
            rot += node.rotation;
            sx *= node.scaleX;
            sy *= node.scaleY;
            node = node.parent;
        }

        return { x, y, rotation: rot, scaleX: sx, scaleY: sy };
    }

    containsPoint(px, py) {
        const t = this.getGlobalTransform();
        const dx = px - t.x;
        const dy = py - t.y;
        const cos = Math.cos(-t.rotation);
        const sin = Math.sin(-t.rotation);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        const hw = (this.width * Math.abs(t.scaleX)) / 2;
        const hh = (this.height * Math.abs(t.scaleY)) / 2;
        return lx >= -hw && lx <= hw && ly >= -hh && ly <= hh;
    }
}

class FlowRuntime {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.root = new FlowNode('root', 'root');
        this.nodes = new Map();
        this.nodes.set('root', this.root);
        this.variables = {};
        this.sprites = new Map();
        this.audioCtx = null;
        this.keys = {};
        this.mouse = { x: 0, y: 0, down: false, justDown: false };
        this.touches = new Map();
        this.gravity = { x: 0, y: 300 };
        this.camera = { x: 0, y: 0, zoom: 1, followTarget: null, shakeIntensity: 0, shakeDuration: 0 };
        this.time = { now: 0, delta: 1/60, scale: 1 };
        this.running = false;
        this.loopId = null;
        this.startBlock = [];
        this.updateBlock = [];
        this.collisionListeners = [];
        this.uiElements = [];
        this.shaders = [];
        this.tilemap = { tiles: [], width: 0, height: 0, tileSize: 32 };
        this.pathfinding = { grid: null, obstacles: new Set() };
        this.inventory = new Map();
        this.dialogue = { active: false, speaker: '', text: '', portrait: null };
        this.particles = [];

        this.setupInput();
    }

    setupInput() {
        const rect = () => this.canvas.getBoundingClientRect();

        window.addEventListener('keydown', e => {
            this.keys[e.code] = true;
            this.keys[e.key.toLowerCase()] = true;
        });

        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.keys[e.key.toLowerCase()] = false;
        });

        this.canvas.addEventListener('mousedown', e => {
            const r = rect();
            this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
            this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
            this.mouse.down = true;
            this.mouse.justDown = true;
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouse.down = false;
        });

        this.canvas.addEventListener('mousemove', e => {
            const r = rect();
            this.mouse.x = (e.clientX - r.left) * (this.canvas.width / r.width);
            this.mouse.y = (e.clientY - r.top) * (this.canvas.height / r.height);
        });

        this.canvas.addEventListener('touchstart', e => {
            e.preventDefault();
            const r = rect();
            for (let touch of e.changedTouches) {
                const tx = (touch.clientX - r.left) * (this.canvas.width / r.width);
                const ty = (touch.clientY - r.top) * (this.canvas.height / r.height);
                this.touches.set(touch.identifier, { x: tx, y: ty, down: true });
                this.mouse.x = tx;
                this.mouse.y = ty;
                this.mouse.down = true;
                this.mouse.justDown = true;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', e => {
            e.preventDefault();
            for (let touch of e.changedTouches) {
                this.touches.delete(touch.identifier);
            }
            if (this.touches.size === 0) this.mouse.down = false;
        });

        this.canvas.addEventListener('touchmove', e => {
            e.preventDefault();
            const r = rect();
            for (let touch of e.changedTouches) {
                const tx = (touch.clientX - r.left) * (this.canvas.width / r.width);
                const ty = (touch.clientY - r.top) * (this.canvas.height / r.height);
                this.touches.set(touch.identifier, { x: tx, y: ty, down: true });
                this.mouse.x = tx;
                this.mouse.y = ty;
            }
        }, { passive: false });
    }

    reset() {
        this.root = new FlowNode('root', 'root');
        this.nodes = new Map();
        this.nodes.set('root', this.root);
        this.variables = {};
        this.running = false;
        this.startBlock = [];
        this.updateBlock = [];
        this.collisionListeners = [];
        this.uiElements = [];
        this.particles = [];
        this.camera = { x: 0, y: 0, zoom: 1, followTarget: null, shakeIntensity: 0, shakeDuration: 0 };
        this.gravity = { x: 0, y: 300 };
        if (this.loopId) cancelAnimationFrame(this.loopId);
    }

    compileAndRun(code) {
        this.lastCode = code;
        this.reset();
        const commands = FlowParser.parse(code);

        let inStart = false;
        let inUpdate = false;
        let currentBlock = [];

        for (const cmd of commands) {
            if (cmd.name === 'core.start') {
                inStart = true;
                currentBlock = this.startBlock;
                continue;
            }
            if (cmd.name === 'core.update') {
                inStart = false;
                inUpdate = true;
                currentBlock = this.updateBlock;
                continue;
            }
            if (cmd.name === 'core.end') {
                inStart = false;
                inUpdate = false;
                currentBlock = [];
                continue;
            }

            if (inStart) this.startBlock.push(cmd);
            else if (inUpdate) this.updateBlock.push(cmd);
            else this.executeCommand(cmd);
        }

        for (const cmd of this.startBlock) {
            this.executeCommand(cmd);
        }

        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.running = false;
        if (this.loopId) cancelAnimationFrame(this.loopId);
    }

    loop() {
        if (!this.running) return;

        const now = performance.now();
        this.time.delta = Math.min((now - this.lastTime) / 1000, 0.1) * this.time.scale;
        this.time.now = now / 1000;
        this.lastTime = now;

        this.mouse.justDown = false;

        for (const cmd of this.updateBlock) {
            this.executeCommand(cmd);
        }

        this.updatePhysics();
        this.updateActions();
        this.updateCamera();
        this.render();

        this.loopId = requestAnimationFrame(() => this.loop());
    }

    updatePhysics() {
        for (const [name, node] of this.nodes) {
            if (node.physics.enabled && node !== this.root) {
                node.vx += this.gravity.x * this.time.delta;
                node.vy += this.gravity.y * this.time.delta;

                node.vx *= (1 - node.physics.friction * this.time.delta);
                node.vy *= (1 - node.physics.friction * this.time.delta);

                node.x += node.vx * this.time.delta;
                node.y += node.vy * this.time.delta;

                node.rotation += node.angularVelocity * this.time.delta;

                const floorY = this.canvas.height - node.height / 2;
                if (node.y > floorY) {
                    node.y = floorY;
                    node.vy *= -node.physics.restitution;
                    if (Math.abs(node.vy) < 10) node.vy = 0;
                }

                const halfW = node.width / 2;
                if (node.x < halfW) { node.x = halfW; node.vx *= -node.physics.restitution; }
                if (node.x > this.canvas.width - halfW) { 
                    node.x = this.canvas.width - halfW; 
                    node.vx *= -node.physics.restitution; 
                }
            }
        }

        for (let i = 0; i < this.collisionListeners.length; i++) {
            const cl = this.collisionListeners[i];
            const a = this.nodes.get(cl.a);
            const b = this.nodes.get(cl.b);
            if (a && b && this.checkCollision(a, b)) {
                cl.callback();
            }
        }
    }

    checkCollision(a, b) {
        const ta = a.getGlobalTransform();
        const tb = b.getGlobalTransform();
        const aw = a.width * Math.abs(ta.scaleX);
        const ah = a.height * Math.abs(ta.scaleY);
        const bw = b.width * Math.abs(tb.scaleX);
        const bh = b.height * Math.abs(tb.scaleY);
        return Math.abs(ta.x - tb.x) < (aw + bw) / 2 && 
               Math.abs(ta.y - tb.y) < (ah + bh) / 2;
    }

    updateActions() {
        for (const [name, node] of this.nodes) {
            if (node.actions.length > 0) {
                const action = node.actions[0];
                action.elapsed += this.time.delta;
                const t = Math.min(action.elapsed / action.duration, 1);

                switch (action.type) {
                    case 'moveBy':
                        node.x = action.startX + action.dx * t;
                        node.y = action.startY + action.dy * t;
                        break;
                    case 'scaleBy':
                        node.scaleX = action.startSX + action.dsX * t;
                        node.scaleY = action.startSY + action.dsY * t;
                        break;
                    case 'rotateBy':
                        node.rotation = action.startRot + action.dRot * t;
                        break;
                    case 'resize':
                        node.width = action.startW + action.dw * t;
                        node.height = action.startH + action.dh * t;
                        break;
                    case 'fadeTo':
                        node.alpha = action.startAlpha + (action.targetAlpha - action.startAlpha) * t;
                        break;
                    case 'wait':
                        break;
                }

                if (t >= 1) {
                    node.actions.shift();
                    if (action.onComplete) action.onComplete();
                }
            }
        }
    }

    updateCamera() {
        if (this.camera.followTarget) {
            const target = this.nodes.get(this.camera.followTarget);
            if (target) {
                const t = this.time.delta * 5;
                this.camera.x += (target.x - this.canvas.width / 2 - this.camera.x) * t;
                this.camera.y += (target.y - this.canvas.height / 2 - this.camera.y) * t;
            }
        }

        if (this.camera.shakeDuration > 0) {
            this.camera.shakeDuration -= this.time.delta;
            if (this.camera.shakeDuration <= 0) this.camera.shakeIntensity = 0;
        }
    }

    render() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, w, h);

        ctx.save();

        let shakeX = 0, shakeY = 0;
        if (this.camera.shakeIntensity > 0) {
            shakeX = (Math.random() - 0.5) * this.camera.shakeIntensity;
            shakeY = (Math.random() - 0.5) * this.camera.shakeIntensity;
        }

        ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
        ctx.scale(this.camera.zoom, this.camera.zoom);
        ctx.translate(-this.camera.x - w / 2, -this.camera.y - h / 2);

        this.renderTilemap(ctx);
        this.renderNode(ctx, this.root);
        this.renderParticles(ctx);

        ctx.restore();

        this.renderUI(ctx);

        if (this.dialogue.active) {
            this.renderDialogue(ctx);
        }
    }

    renderNode(ctx, node) {
        if (!node.visible) return;

        ctx.save();
        ctx.translate(node.x, node.y);
        ctx.rotate(node.rotation);
        ctx.scale(node.scaleX * (node.flipX ? -1 : 1), node.scaleY * (node.flipY ? -1 : 1));
        ctx.globalAlpha = node.alpha;

        if (node.color) {
            ctx.fillStyle = node.color;
            ctx.fillRect(-node.width / 2, -node.height / 2, node.width, node.height);
        }

        if (node.texture && this.sprites.has(node.texture)) {
            const img = this.sprites.get(node.texture);
            ctx.drawImage(img, -node.width / 2, -node.height / 2, node.width, node.height);
        } else if (!node.color && node.type !== 'label') {
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 2;
            ctx.strokeRect(-node.width / 2, -node.height / 2, node.width, node.height);
            ctx.fillStyle = '#333';
            ctx.fillRect(-node.width / 2, -node.height / 2, node.width, node.height);
        }

        if (node.type === 'label' || node.text) {
            ctx.fillStyle = node.textColor;
            ctx.font = `${node.fontSize}px Inter, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(node.text, 0, 0);
        }

        for (const child of node.children) {
            this.renderNode(ctx, child);
        }

        ctx.restore();
    }

    renderTilemap(ctx) {
        if (!this.tilemap.tiles.length) return;
        const ts = this.tilemap.tileSize;
        for (let y = 0; y < this.tilemap.height; y++) {
            for (let x = 0; x < this.tilemap.width; x++) {
                const tile = this.tilemap.tiles[y]?.[x];
                if (tile) {
                    ctx.fillStyle = tile.color || '#444';
                    ctx.fillRect(x * ts, y * ts, ts, ts);
                    ctx.strokeStyle = '#333';
                    ctx.strokeRect(x * ts, y * ts, ts, ts);
                }
            }
        }
    }

    renderParticles(ctx) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= this.time.delta;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.x += p.vx * this.time.delta;
            p.y += p.vy * this.time.delta;
            const alpha = p.life / p.maxLife;
            ctx.globalAlpha = alpha * p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    renderUI(ctx) {
        for (const ui of this.uiElements) {
            if (ui.type === 'button') {
                ctx.fillStyle = ui.bgColor || '#0a84ff';
                ctx.beginPath();
                ctx.roundRect(ui.x, ui.y, ui.width, ui.height, 8);
                ctx.fill();
                ctx.fillStyle = ui.textColor || '#fff';
                ctx.font = `14px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ui.text, ui.x + ui.width / 2, ui.y + ui.height / 2);
            } else if (ui.type === 'progressBar') {
                ctx.fillStyle = '#333';
                ctx.fillRect(ui.x, ui.y, ui.width, ui.height);
                ctx.fillStyle = ui.color || '#0a84ff';
                ctx.fillRect(ui.x, ui.y, ui.width * ui.progress, ui.height);
            } else if (ui.type === 'slider') {
                ctx.fillStyle = '#333';
                ctx.fillRect(ui.x, ui.y + ui.height / 2 - 2, ui.width, 4);
                ctx.fillStyle = '#0a84ff';
                const pct = (ui.value - ui.min) / (ui.max - ui.min);
                ctx.fillRect(ui.x, ui.y + ui.height / 2 - 2, ui.width * pct, 4);
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(ui.x + ui.width * pct, ui.y + ui.height / 2, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    renderDialogue(ctx) {
        const pad = 20;
        const boxH = 120;
        const y = this.canvas.height - boxH - pad;

        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        ctx.beginPath();
        ctx.roundRect(pad, y, this.canvas.width - pad * 2, boxH, 12);
        ctx.fill();

        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#0a84ff';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(this.dialogue.speaker, pad + 16, y + 28);

        ctx.fillStyle = '#fff';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillText(this.dialogue.text, pad + 16, y + 60);
    }

    executeCommand(cmd) {
        try {
            const [category, action] = cmd.name.split('.');
            const a = cmd.args;

            switch (category) {
                case 'core':
                    this.handleCore(action, a, cmd);
                    break;
                case 'node':
                    this.handleNode(action, a);
                    break;
                case 'action':
                    this.handleAction(action, a);
                    break;
                case 'variables':
                    this.handleVariables(action, a);
                    break;
                case 'math':
                    return this.handleMath(action, a);
                case 'graphics':
                    this.handleGraphics(action, a);
                    break;
                case 'input':
                    return this.handleInput(action, a);
                case 'motion':
                    this.handleMotion(action, a);
                    break;
                case 'time':
                    this.handleTime(action, a);
                    break;
                case 'audio':
                    this.handleAudio(action, a);
                    break;
                case 'physics':
                    this.handlePhysics(action, a);
                    break;
                case 'ui':
                    this.handleUI(action, a);
                    break;
                case 'camera':
                    this.handleCamera(action, a);
                    break;
                case 'sprite':
                    this.handleSprite(action, a);
                    break;
                case 'tilemap':
                    this.handleTilemap(action, a);
                    break;
                case 'sensing':
                    return this.handleSensing(action, a);
                case 'inventory':
                    this.handleInventory(action, a);
                    break;
                case 'dialogue':
                    this.handleDialogue(action, a);
                    break;
                case 'combat':
                    this.handleCombat(action, a);
                    break;
                case 'control':
                    this.handleControl(action, a);
                    break;
                case 'comment':
                    break;
                default:
                    console.warn(`Unknown category: ${category}`);
            }
        } catch (e) {
            console.error(`FlowScript Error (line ${cmd.line}): ${e.message}`, cmd.raw);
        }
    }

    handleCore(action, a, cmd) {
        switch (action) {
            case 'start':
            case 'update':
            case 'end':
                break;
            case 'restart':
                this.compileAndRun(this.lastCode || '');
                break;
            case 'pause':
                this.time.scale = 0;
                break;
            case 'quit':
                this.stop();
                break;
        }
    }

    handleNode(action, a) {
        const name = a._ || a.name || 'node' + Math.floor(Math.random() * 10000);
        switch (action) {
            case 'addChild':
                const parent = this.nodes.get(a.to || 'root');
                const child = this.nodes.get(name);
                if (parent && child) parent.addChild(child);
                break;
            case 'removeFromParent':
                const node = this.nodes.get(name);
                if (node) node.removeFromParent();
                break;
            case 'run':
                break;
            case 'contains':
                const n = this.nodes.get(name);
                if (n) return n.containsPoint(a.x || 0, a.y || 0);
                break;
        }
    }

    handleAction(action, a) {
        const name = a._ || a.name || a.target;
        const node = name ? this.nodes.get(name) : null;
        if (!node && name) return;

        const duration = a.duration || 1;

        switch (action) {
            case 'moveBy':
                if (node) {
                    node.actions.push({
                        type: 'moveBy',
                        startX: node.x,
                        startY: node.y,
                        dx: (a.x || a.dx || 0),
                        dy: (a.y || a.dy || 0),
                        duration,
                        elapsed: 0
                    });
                }
                break;
            case 'scaleBy':
                if (node) {
                    node.actions.push({
                        type: 'scaleBy',
                        startSX: node.scaleX,
                        startSY: node.scaleY,
                        dsX: (a.x || a.scaleX || a._ || 1) - 1,
                        dsY: (a.y || a.scaleY || a._ || 1) - 1,
                        duration,
                        elapsed: 0
                    });
                }
                break;
            case 'rotateBy':
                if (node) {
                    node.actions.push({
                        type: 'rotateBy',
                        startRot: node.rotation,
                        dRot: a.angle || a._ || 0,
                        duration,
                        elapsed: 0
                    });
                }
                break;
            case 'resize':
                if (node) {
                    node.actions.push({
                        type: 'resize',
                        startW: node.width,
                        startH: node.height,
                        dw: a.byWidth || a.width || 0,
                        dh: a.height || 0,
                        duration,
                        elapsed: 0
                    });
                }
                break;
            case 'speed':
                this.time.scale = a.by || a._ || 1;
                break;
        }
    }

    handleVariables(action, a) {
        const name = a._ || a.name;
        switch (action) {
            case 'set':
                this.variables[name] = a.value !== undefined ? a.value : a.to;
                break;
            case 'get':
                return this.variables[name];
            case 'add':
                this.variables[name] = (this.variables[name] || 0) + (a.amount || 0);
                break;
            case 'sub':
                this.variables[name] = (this.variables[name] || 0) - (a.amount || 0);
                break;
            case 'exists':
                return name in this.variables;
        }
    }

    handleMath(action, a) {
        switch (action) {
            case 'sin': return Math.sin(a._ || a.angle || 0);
            case 'cos': return Math.cos(a._ || a.angle || 0);
            case 'atan2': return Math.atan2(a.y || 0, a.x || 0);
            case 'distance':
                const dx = (a.toX || a.to?.x || 0) - (a.fromX || a.from?.x || 0);
                const dy = (a.toY || a.to?.y || 0) - (a.fromY || a.from?.y || 0);
                return Math.sqrt(dx * dx + dy * dy);
            case 'random':
                const min = a.min || 0;
                const max = a.max || 1;
                return Math.random() * (max - min) + min;
        }
        return 0;
    }

    handleGraphics(action, a) {
        const name = a._ || a.name || a.target;
        const node = name ? this.nodes.get(name) : null;

        switch (action) {
            case 'loadTexture':
                if (a.src && !this.sprites.has(a.src)) {
                    const img = new Image();
                    img.src = a.src;
                    img.onload = () => this.sprites.set(a.src, img);
                    this.sprites.set(a.src, img);
                }
                break;
            case 'setBlendMode':
                break;
            case 'setColor':
                if (node) node.color = a._ || a.color || '#fff';
                break;
            case 'setAlpha':
                if (node) node.alpha = a._ || a.alpha || 1;
                break;
            case 'createShader':
                break;
        }
    }

    handleInput(action, a) {
        const key = a._ || a.key || a.button;
        switch (action) {
            case 'isPressed':
                return this.keys[key] || this.keys[key?.toLowerCase()] || this.mouse.down;
            case 'justPressed':
                return this.mouse.justDown || (this.keys[key] && !this.keys['__prev_' + key]);
            case 'getPosition':
                return { x: this.mouse.x, y: this.mouse.y };
            case 'getAxis':
                let x = 0, y = 0;
                if (this.keys['KeyW'] || this.keys['ArrowUp'] || this.keys['w']) y -= 1;
                if (this.keys['KeyS'] || this.keys['ArrowDown'] || this.keys['s']) y += 1;
                if (this.keys['KeyA'] || this.keys['ArrowLeft'] || this.keys['a']) x -= 1;
                if (this.keys['KeyD'] || this.keys['ArrowRight'] || this.keys['d']) x += 1;
                return { x, y };
            case 'onSwipe':
                break;
        }
        return false;
    }

    handleMotion(action, a) {
        const name = a._ || a.name || a.target;
        const node = this.nodes.get(name);
        if (!node) return;

        switch (action) {
            case 'applyForce':
                node.vx += (a.x || a.dx || 0) * this.time.delta;
                node.vy += (a.y || a.dy || 0) * this.time.delta;
                break;
            case 'applyImpulse':
                node.vx += a.x || a.dx || 0;
                node.vy += a.y || a.dy || 0;
                break;
            case 'applyTorque':
                node.angularVelocity += (a._ || a.torque || 0) * this.time.delta;
                break;
            case 'setVelocity':
                node.vx = a.linear?.x || a.linear || a.vx || 0;
                node.vy = a.linear?.y || a.vy || 0;
                node.angularVelocity = a.angular || 0;
                break;
        }
    }

    handleTime(action, a) {
        switch (action) {
            case 'delta':
                return this.time.delta;
            case 'now':
                return this.time.now;
            case 'setFps':
                break;
            case 'delay':
                setTimeout(a.block || (() => {}), (a.seconds || 0) * 1000);
                break;
            case 'scale':
                this.time.scale = a._ || 1;
                break;
        }
        return this.time.delta;
    }

    handleAudio(action, a) {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        switch (action) {
            case 'playMusic':
            case 'playSound':
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.frequency.value = a.frequency || 440;
                gain.gain.value = (a.volume || 0.5) * 0.1;
                osc.start();
                osc.stop(this.audioCtx.currentTime + (a.duration || 0.1));
                break;
            case 'setVolume':
                break;
            case 'stop':
                break;
            case 'fadeTo':
                break;
        }
    }

    handlePhysics(action, a) {
        const name = a._ || a.name || a.target;
        const node = this.nodes.get(name);

        switch (action) {
            case 'setGravity':
                this.gravity.x = a.x || a._?.x || 0;
                this.gravity.y = a.y || a._?.y || 300;
                break;
            case 'setRestitution':
                if (node) node.physics.restitution = a._ || a.value || 0.5;
                break;
            case 'setFriction':
                if (node) node.physics.friction = a._ || a.value || 0.3;
                break;
            case 'raycast':
                return { hit: false };
            case 'onCollision':
                this.collisionListeners.push({
                    a: a.between || a._,
                    b: a.and || a.with,
                    callback: a.block || (() => {})
                });
                break;
        }
    }

    handleUI(action, a) {
        switch (action) {
            case 'button':
                this.uiElements.push({
                    type: 'button',
                    text: a.text || 'Button',
                    x: a.position?.x || a.x || 10,
                    y: a.position?.y || a.y || 10,
                    width: a.width || 120,
                    height: a.height || 40,
                    bgColor: a.bg || '#0a84ff',
                    textColor: a.color || '#fff',
                    block: a.block
                });
                break;
            case 'label':
                const labelNode = new FlowNode(a._ || a.name || 'label', 'label');
                labelNode.x = a.position?.x || a.x || 100;
                labelNode.y = a.position?.y || a.y || 100;
                labelNode.text = a.text || '';
                labelNode.fontSize = a.size || 16;
                labelNode.textColor = a.color || '#fff';
                this.root.addChild(labelNode);
                this.nodes.set(labelNode.name, labelNode);
                break;
            case 'slider':
                this.uiElements.push({
                    type: 'slider',
                    min: a.min || 0,
                    max: a.max || 100,
                    value: a.value || 50,
                    x: a.x || 10,
                    y: a.y || 10,
                    width: a.width || 200,
                    height: a.height || 30
                });
                break;
            case 'progressBar':
                this.uiElements.push({
                    type: 'progressBar',
                    progress: a.progress || a._ || 0,
                    x: a.x || 10,
                    y: a.y || 10,
                    width: a.width || 200,
                    height: a.height || 16,
                    color: a.color || '#0a84ff'
                });
                break;
            case 'panel':
                const panel = new FlowNode(a._ || 'panel', 'panel');
                panel.x = a.position?.x || a.x || 0;
                panel.y = a.position?.y || a.y || 0;
                panel.width = a.size?.width || a.width || 200;
                panel.height = a.size?.height || a.height || 200;
                panel.color = a.color || 'rgba(0,0,0,0.5)';
                this.root.addChild(panel);
                this.nodes.set(panel.name, panel);
                break;
        }
    }

    handleCamera(action, a) {
        const name = a._ || a.target || a.name;
        switch (action) {
            case 'follow':
                this.camera.followTarget = name;
                break;
            case 'shake':
                this.camera.shakeIntensity = a.intensity || 10;
                this.camera.shakeDuration = a.duration || 0.5;
                break;
            case 'zoom':
                this.camera.zoom = a._ || a.value || 1;
                break;
            case 'pan':
                this.camera.x = a.to?.x || a.x || 0;
                this.camera.y = a.to?.y || a.y || 0;
                break;
            case 'setBounds':
                break;
        }
    }

    handleSprite(action, a) {
        const name = a._ || a.name || 'sprite' + Math.floor(Math.random() * 10000);
        let node = this.nodes.get(name);

        switch (action) {
            case 'set':
                if (!node) {
                    node = new FlowNode(name, 'sprite');
                    this.root.addChild(node);
                    this.nodes.set(name, node);
                }
                if (a.src || a.texture) node.texture = a.src || a.texture;
                if (a.x !== undefined) node.x = a.x;
                if (a.y !== undefined) node.y = a.y;
                if (a.width) node.width = a.width;
                if (a.height) node.height = a.height;
                break;
            case 'setAnimation':
                break;
            case 'flip':
                if (node) {
                    if (a.x !== undefined) node.flipX = a.x;
                    if (a.y !== undefined) node.flipY = a.y;
                }
                break;
            case 'setTint':
                if (node) node.color = a.color || a._ || null;
                break;
            case 'setOpacity':
                if (node) node.alpha = a._ || a.alpha || 1;
                break;
            case 'setDefaultSize':
                break;
            case 'setScale':
                if (node) {
                    node.scaleX = a._ || a.x || 1;
                    node.scaleY = a.y || a._ || 1;
                }
                break;
            case 'setAnchor':
                break;
            case 'setLayer':
                if (node) node.zIndex = a._ || 0;
                break;
            case 'setVisible':
                if (node) node.visible = a._ !== false && a.visible !== false;
                break;
        }
    }

    handleTilemap(action, a) {
        switch (action) {
            case 'setTile':
                const x = a.x || 0;
                const y = a.y || 0;
                if (!this.tilemap.tiles[y]) this.tilemap.tiles[y] = [];
                this.tilemap.tiles[y][x] = { id: a.tile || a._ || 1, color: a.color };
                break;
            case 'getTile':
                return this.tilemap.tiles[a.y]?.[a.x]?.id || 0;
            case 'removeTile':
                if (this.tilemap.tiles[a.y]) this.tilemap.tiles[a.y][a.x] = null;
                break;
            case 'setCollision':
                break;
            case 'load':
                break;
        }
    }

    handleSensing(action, a) {
        const name = a._ || a.name || a.target;
        const node = this.nodes.get(name);
        const other = this.nodes.get(a.with || a._);

        switch (action) {
            case 'touching':
                if (node && other) return this.checkCollision(node, other);
                return false;
            case 'distanceTo':
                if (node && other) {
                    const dx = node.x - other.x;
                    const dy = node.y - other.y;
                    return Math.sqrt(dx * dx + dy * dy);
                }
                return Infinity;
            case 'facing':
                if (node) {
                    const targetAngle = a._ || a.angle || 0;
                    return Math.abs(node.rotation - targetAngle) < 0.1;
                }
                return false;
            case 'canSee':
                return true;
            case 'mouseOver':
                if (node) return node.containsPoint(this.mouse.x, this.mouse.y);
                return false;
        }
        return false;
    }

    handleInventory(action, a) {
        const id = a._ || a.id || a.item;
        switch (action) {
            case 'addItem':
                const current = this.inventory.get(id) || 0;
                this.inventory.set(id, current + (a.count || 1));
                break;
            case 'removeItem':
                const curr = this.inventory.get(id) || 0;
                this.inventory.set(id, Math.max(0, curr - (a.count || 1)));
                break;
            case 'hasItem':
                return (this.inventory.get(id) || 0) > 0;
        }
        return false;
    }

    handleDialogue(action, a) {
        switch (action) {
            case 'show':
                this.dialogue.active = true;
                this.dialogue.speaker = a.speaker || '';
                this.dialogue.text = a.text || '';
                this.dialogue.portrait = a.portrait || null;
                break;
        }
    }

    handleCombat(action, a) {
        const target = this.nodes.get(a.target);
        switch (action) {
            case 'dealDamage':
                if (target) {
                    target.alpha = 0.5;
                    setTimeout(() => target.alpha = 1, 100);
                }
                break;
        }
    }

    handleControl(action, a) {
        switch (action) {
            case 'pause':
                this.time.scale = 0;
                break;
            case 'resume':
                this.time.scale = 1;
                break;
            case 'stop':
                for (const [name, node] of this.nodes) {
                    node.actions = [];
                }
                break;
            case 'wait':
                break;
            case 'delay':
                setTimeout(a.block || (() => {}), (a._ || a.duration || 0) * 1000);
                break;
        }
    }

    ensureNode(name, type = 'sprite') {
        if (!this.nodes.has(name)) {
            const node = new FlowNode(name, type);
            this.root.addChild(node);
            this.nodes.set(name, node);
        }
        return this.nodes.get(name);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlowParser, FlowRuntime, FlowNode };
}
