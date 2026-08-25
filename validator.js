/**
 * FlowValidator — Strict Pre-Publication Game Analyzer
 * Checks for crashes, lag, unoptimized code, and malicious patterns
 */

class FlowValidator {
    constructor() {
        this.MAX_PROJECT_SIZE_MB = 5;
        this.MAX_PROJECT_SIZE_BYTES = this.MAX_PROJECT_SIZE_MB * 1024 * 1024;
        this.MAX_SPRITES = 50;
        this.MAX_SPRITE_DIMENSION = 512;
        this.MAX_CODE_LINES = 2000;
        this.MAX_CODE_CHARS = 100000;
        this.MAX_NODES_PER_FRAME = 100;
        this.MAX_ACTIONS_PER_NODE = 10;
        this.MAX_PARTICLES = 500;
        this.MAX_UI_ELEMENTS = 20;
        this.MAX_AUDIO_CALLS_PER_FRAME = 5;
        this.MAX_PHYSICS_OBJECTS = 30;
        this.MAX_COLLISION_LISTENERS = 20;
        this.WARNINGS = [];
        this.ERRORS = [];
    }

    validate(project) {
        this.WARNINGS = [];
        this.ERRORS = [];

        // 1. Size Check
        this.checkProjectSize(project);

        // 2. Code Analysis
        this.analyzeCode(project.code);

        // 3. Sprite Analysis
        this.analyzeSprites(project.sprites);

        // 4. Performance & Lag Analysis
        this.analyzePerformance(project);

        // 5. Security & Crash Analysis
        this.analyzeSecurity(project);

        // 6. Mobile Optimization
        this.analyzeMobileOptimization(project);

        return {
            passed: this.ERRORS.length === 0,
            errors: this.ERRORS,
            warnings: this.WARNINGS,
            score: this.calculateScore()
        };
    }

    // ========== SIZE CHECKS ==========

    checkProjectSize(project) {
        let totalSize = 0;

        // Code size
        const codeBytes = new Blob([project.code]).size;
        totalSize += codeBytes;

        // Sprite sizes
        for (const sprite of (project.sprites || [])) {
            if (sprite.data) {
                // Base64 overhead ~33%
                const base64Size = Math.ceil(sprite.data.length * 0.75);
                totalSize += base64Size;
            }
        }

        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);

        if (totalSize > this.MAX_PROJECT_SIZE_BYTES) {
            this.ERRORS.push({
                type: 'SIZE_LIMIT',
                severity: 'CRITICAL',
                message: `Project size (${sizeMB} MB) exceeds the 5 MB limit.`,
                details: `Your game is too large for mobile distribution. Reduce sprite image sizes or compress them. Current: ${sizeMB}MB / 5MB allowed.`,
                fix: 'Use smaller sprite images (max 512x512px), compress PNGs, or reduce the number of sprites.'
            });
        } else if (totalSize > this.MAX_PROJECT_SIZE_BYTES * 0.8) {
            this.WARNINGS.push({
                type: 'SIZE_WARNING',
                severity: 'WARNING',
                message: `Project is ${sizeMB} MB — approaching 5 MB limit.`,
                fix: 'Consider compressing sprites or reducing their count.'
            });
        }
    }

    // ========== CODE ANALYSIS ==========

    analyzeCode(code) {
        if (!code || !code.trim()) {
            this.ERRORS.push({
                type: 'EMPTY_CODE',
                severity: 'CRITICAL',
                message: 'Game code is empty.',
                details: 'The FlowScript editor contains no code. A game cannot run without instructions.',
                fix: 'Write at least a basic game loop with <fs core.start> and <fs core.update> blocks.'
            });
            return;
        }

        const lines = code.split('\n');
        const cleanLines = lines.filter(l => l.trim() && !l.trim().startsWith('//'));

        // Line count
        if (cleanLines.length > this.MAX_CODE_LINES) {
            this.ERRORS.push({
                type: 'CODE_TOO_LONG',
                severity: 'CRITICAL',
                message: `Code has ${cleanLines.length} active lines — max is ${this.MAX_CODE_LINES}.`,
                details: 'Excessively long code causes slow compilation and poor runtime performance on mobile devices.',
                fix: 'Refactor your code. Use loops, functions (when supported), or split logic into smaller modules.'
            });
        }

        // Char count
        if (code.length > this.MAX_CODE_CHARS) {
            this.ERRORS.push({
                type: 'CODE_TOO_LARGE',
                severity: 'CRITICAL',
                message: `Code is ${code.length.toLocaleString()} characters — max is ${this.MAX_CODE_CHARS.toLocaleString()}.`,
                details: 'Large codebases increase memory usage and slow down the compiler.',
                fix: 'Remove unnecessary comments, whitespace, or redundant commands.'
            });
        }

        // Syntax validation — parse every line
        const commands = FlowParser.parse(code);
        const invalidLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//')) continue;

            const match = line.match(/<fs\s+([^(>\s]+)/);
            if (!match) {
                invalidLines.push({ line: i + 1, text: line.substring(0, 60) });
            }
        }

        if (invalidLines.length > 0) {
            const examples = invalidLines.slice(0, 3).map(l => `Line ${l.line}: "${l.text}"`).join('\n');
            this.ERRORS.push({
                type: 'SYNTAX_ERROR',
                severity: 'CRITICAL',
                message: `${invalidLines.length} syntax error(s) found in FlowScript.`,
                details: `The following lines are not valid FlowScript syntax:\n${examples}${invalidLines.length > 3 ? `\n...and ${invalidLines.length - 3} more.` : ''}`,
                fix: 'All FlowScript commands must follow the format: <fs namespace.actionName(key:value)>. Check for typos, missing brackets, or invalid namespaces.'
            });
        }

        // Check for required game loop
        const hasStart = code.includes('<fs core.start>');
        const hasUpdate = code.includes('<fs core.update>');

        if (!hasStart && !hasUpdate) {
            this.ERRORS.push({
                type: 'MISSING_GAME_LOOP',
                severity: 'CRITICAL',
                message: 'No game loop detected.',
                details: 'Every FlowScript game needs at least a <fs core.start> block (runs once) or <fs core.update> block (runs every frame). Without these, nothing will execute.',
                fix: 'Add <fs core.start> for initialization and <fs core.update> for your main game loop. End each block with <fs core.end>.'
            });
        }

        // Check for unclosed blocks
        const startCount = (code.match(/<fs core\.start>/g) || []).length;
        const endCount = (code.match(/<fs core\.end>/g) || []).length;

        if (startCount !== endCount) {
            this.ERRORS.push({
                type: 'UNCLOSED_BLOCK',
                severity: 'CRITICAL',
                message: `Unclosed code block(s): ${startCount} start(s) but ${endCount} end(s).`,
                details: 'Every <fs core.start> or <fs core.update> must be closed with <fs core.end>. Mismatched blocks will crash the compiler.',
                fix: `Add ${startCount - endCount} more <fs core.end> tag(s) to close your blocks.`
            });
        }

        // Check for infinite loop patterns
        this.detectInfiniteLoops(code, commands);

        // Check for deprecated or invalid namespaces
        this.checkNamespaces(commands);

        // Check for missing node references
        this.checkNodeReferences(commands);
    }

    detectInfiniteLoops(code, commands) {
        // Pattern 1: No frame-rate limiting in update blocks
        const updateBlocks = code.split('<fs core.update>');
        for (let i = 1; i < updateBlocks.length; i++) {
            const block = updateBlocks[i].split('<fs core.end>')[0];

            // Count heavy operations per frame
            const spriteSets = (block.match(/<fs sprite\.set/g) || []).length;
            const physicsCalls = (block.match(/<fs motion\.apply/g) || []).length;
            const audioCalls = (block.match(/<fs audio\.play/g) || []).length;
            const uiUpdates = (block.match(/<fs ui\./g) || []).length;

            if (spriteSets > 10) {
                this.ERRORS.push({
                    type: 'LAG_MACHINE_SPRITE',
                    severity: 'CRITICAL',
                    message: `Update block creates ${spriteSets} sprites per frame — this is a lag machine.`,
                    details: 'Creating multiple sprites every frame causes exponential memory growth and will freeze/crash the game within seconds. This pattern is indistinguishable from intentional sabotage.',
                    fix: 'Create sprites ONCE inside <fs core.start>, not inside <fs core.update>. If you need dynamic objects, create them conditionally with a spawn timer or limit.'
                });
            }

            if (audioCalls > this.MAX_AUDIO_CALLS_PER_FRAME) {
                this.ERRORS.push({
                    type: 'AUDIO_SPAM',
                    severity: 'CRITICAL',
                    message: `Update block triggers ${audioCalls} audio events per frame — max is ${this.MAX_AUDIO_CALLS_PER_FRAME}.`,
                    details: 'Playing too many sounds simultaneously causes audio context overload, browser crashes, and severe lag on mobile devices.',
                    fix: 'Use <fs input.justPressed()> to trigger sounds only on key press, not every frame. Add cooldown timers between sound effects.'
                });
            }

            if (uiUpdates > this.MAX_UI_ELEMENTS) {
                this.ERRORS.push({
                    type: 'UI_OVERLOAD',
                    severity: 'CRITICAL',
                    message: `Update block updates ${uiUpdates} UI elements per frame — max is ${this.MAX_UI_ELEMENTS}.`,
                    details: 'Redrawing UI every frame is expensive. Too many UI updates will drop the frame rate below playable levels on phones.',
                    fix: 'Only update UI when values change. Store previous values and compare before calling ui.label or ui.progressBar.'
                });
            }
        }

        // Pattern 2: Recursive-like patterns (variables adding to themselves without condition)
        const recursivePattern = /<fs variables\.add\(_:"([^"]+)"\s+amount:\s*[^>]+\)>/g;
        let match;
        while ((match = recursivePattern.exec(code)) !== null) {
            const varName = match[1];
            // Check if there's any reset condition for this variable
            const hasReset = new RegExp(`variables\.set\(_:"${varName}"\s+value:(?!\s*\+)|variables\.sub\(_:"${varName}"`).test(code);
            if (!hasReset && !code.includes('core.restart')) {
                this.WARNINGS.push({
                    type: 'UNBOUNDED_GROWTH',
                    severity: 'WARNING',
                    message: `Variable "${varName}" grows indefinitely without reset.`,
                    fix: `Add a reset condition for "${varName}" or cap its maximum value to prevent memory issues.`
                });
            }
        }
    }

    checkNamespaces(commands) {
        const validNamespaces = [
            'core', 'node', 'action', 'variables', 'math', 'graphics',
            'input', 'motion', 'time', 'audio', 'physics', 'ui',
            'camera', 'sprite', 'tilemap', 'sensing', 'inventory',
            'dialogue', 'combat', 'control', 'comment', 'animation',
            'pathfinding', 'shaders', 'ai', 'networking', 'storage'
        ];

        for (const cmd of commands) {
            const ns = cmd.name.split('.')[0];
            if (!validNamespaces.includes(ns)) {
                this.ERRORS.push({
                    type: 'INVALID_NAMESPACE',
                    severity: 'CRITICAL',
                    message: `Invalid namespace "${ns}" in command "${cmd.raw}".`,
                    details: `"${ns}" is not a recognized FlowScript namespace. The compiler will fail to execute this line.`,
                    fix: `Valid namespaces are: ${validNamespaces.join(', ')}. Check for typos in your command.`
                });
            }
        }
    }

    checkNodeReferences(commands) {
        const declaredNodes = new Set();
        const referencedNodes = new Set();

        for (const cmd of commands) {
            const args = cmd.args;

            // Track declarations
            if (cmd.name === 'sprite.set' && args._) {
                declaredNodes.add(args._);
            }
            if (cmd.name === 'ui.label' && args._name) {
                declaredNodes.add(args._name);
            }

            // Track references
            const nameFields = ['_', 'name', 'target', 'with', 'to', 'from'];
            for (const field of nameFields) {
                if (args[field] && typeof args[field] === 'string') {
                    referencedNodes.add(args[field]);
                }
            }
        }

        // Check for references to undeclared nodes (with some exceptions for built-ins)
        const builtIns = ['root', 'hero', 'player', 'enemy', 'ground', 'move'];
        for (const ref of referencedNodes) {
            if (!declaredNodes.has(ref) && !builtIns.includes(ref) && !ref.includes('.')) {
                this.WARNINGS.push({
                    type: 'UNDECLARED_NODE',
                    severity: 'WARNING',
                    message: `Node "${ref}" is referenced but never declared with sprite.set.`,
                    fix: `Add <fs sprite.set(_:"${ref}" x:0 y:0 width:32 height:32)> before using it.`
                });
            }
        }
    }

    // ========== SPRITE ANALYSIS ==========

    analyzeSprites(sprites) {
        if (!sprites || sprites.length === 0) {
            this.WARNINGS.push({
                type: 'NO_SPRITES',
                severity: 'WARNING',
                message: 'No custom sprites imported.',
                details: 'The game uses only colored rectangles. While functional, adding sprites improves visual quality.',
                fix: 'Import sprite images using the Sprite Library panel below the emulator.'
            });
            return;
        }

        if (sprites.length > this.MAX_SPRITES) {
            this.ERRORS.push({
                type: 'TOO_MANY_SPRITES',
                severity: 'CRITICAL',
                message: `${sprites.length} sprites — maximum allowed is ${this.MAX_SPRITES}.`,
                details: 'Too many sprites cause texture memory exhaustion on mobile GPUs, leading to crashes or severe lag.',
                fix: 'Consolidate sprites into sprite sheets, reuse assets, or remove unused sprites.'
            });
        }

        let totalSpriteBytes = 0;

        for (let i = 0; i < sprites.length; i++) {
            const sprite = sprites[i];

            // Check dimensions
            if (sprite.width > this.MAX_SPRITE_DIMENSION || sprite.height > this.MAX_SPRITE_DIMENSION) {
                this.ERRORS.push({
                    type: 'SPRITE_TOO_LARGE',
                    severity: 'CRITICAL',
                    message: `Sprite "${sprite.name}" is ${sprite.width}x${sprite.height}px — max is ${this.MAX_SPRITE_DIMENSION}x${this.MAX_SPRITE_DIMENSION}.`,
                    details: 'Oversized sprites waste GPU memory and cause texture allocation failures on older phones.',
                    fix: `Resize "${sprite.name}" to max ${this.MAX_SPRITE_DIMENSION}x${this.MAX_SPRITE_DIMENSION}px before importing.`
                });
            }

            // Check for empty/corrupt data
            if (!sprite.data || sprite.data.length < 100) {
                this.ERRORS.push({
                    type: 'CORRUPT_SPRITE',
                    severity: 'CRITICAL',
                    message: `Sprite "${sprite.name}" appears to be corrupted or empty.`,
                    details: 'The sprite data is missing or too small to be a valid image.',
                    fix: 'Re-import the sprite image. Ensure the file is a valid PNG or JPG.'
                });
            }

            // Check file type (must be image)
            if (sprite.data && !sprite.data.startsWith('data:image/')) {
                this.ERRORS.push({
                    type: 'INVALID_SPRITE_FORMAT',
                    severity: 'CRITICAL',
                    message: `Sprite "${sprite.name}" is not a valid image format.`,
                    details: 'Only PNG, JPG, and WEBP images are supported. The file may be corrupted or in an unsupported format.',
                    fix: 'Convert the image to PNG or JPG format before importing.'
                });
            }

            // Estimate size
            if (sprite.data) {
                const bytes = Math.ceil(sprite.data.length * 0.75);
                totalSpriteBytes += bytes;

                if (bytes > 1024 * 1024) { // 1MB per sprite
                    this.ERRORS.push({
                        type: 'SPRITE_TOO_HEAVY',
                        severity: 'CRITICAL',
                        message: `Sprite "${sprite.name}" exceeds 1 MB.`,
                        details: 'Individual sprites should be under 1MB. Large images cause long load times and memory pressure.',
                        fix: 'Compress the image using TinyPNG or similar tools, or reduce its dimensions.'
                    });
                }
            }

            // Check name validity
            if (!sprite.name || sprite.name.length < 1) {
                this.ERRORS.push({
                    type: 'INVALID_SPRITE_NAME',
                    severity: 'CRITICAL',
                    message: `Sprite #${i + 1} has no name.`,
                    details: 'All sprites must have a valid name to be referenced in code.',
                    fix: 'Re-import the sprite with a proper filename.'
                });
            }

            // Check for duplicate names
            const nameCount = sprites.filter(s => s.name === sprite.name).length;
            if (nameCount > 1) {
                this.ERRORS.push({
                    type: 'DUPLICATE_SPRITE_NAME',
                    severity: 'CRITICAL',
                    message: `Sprite name "${sprite.name}" is used ${nameCount} times.`,
                    details: 'Duplicate sprite names cause reference ambiguity. The compiler cannot determine which sprite to use.',
                    fix: 'Rename one of the duplicate sprites to a unique name.'
                });
            }
        }

        // Total sprite memory
        const totalSpriteMB = (totalSpriteBytes / (1024 * 1024)).toFixed(2);
        if (totalSpriteBytes > 3 * 1024 * 1024) { // 3MB for sprites alone
            this.ERRORS.push({
                type: 'SPRITE_MEMORY_EXCEEDED',
                severity: 'CRITICAL',
                message: `Sprites total ${totalSpriteMB} MB — max recommended is 3 MB.`,
                details: 'Sprite textures consume GPU VRAM. Exceeding 3MB causes texture thrashing and frame drops on mid-range phones.',
                fix: 'Use texture atlases, reduce color depth, or compress images more aggressively.'
            });
        }
    }

    // ========== PERFORMANCE ANALYSIS ==========

    analyzePerformance(project) {
        const code = project.code || '';

        // Count potential physics objects
        const physicsEnabled = (code.match(/physics\.setGravity|physics\.setRestitution|motion\.setVelocity/g) || []).length;
        if (physicsEnabled > this.MAX_PHYSICS_OBJECTS) {
            this.ERRORS.push({
                type: 'PHYSICS_OVERLOAD',
                severity: 'CRITICAL',
                message: `Detected ${physicsEnabled} physics interactions — max stable is ${this.MAX_PHYSICS_OBJECTS}.`,
                details: 'Too many simultaneous physics calculations will drop the frame rate below 30 FPS on mobile devices.',
                fix: 'Limit active physics objects. Use simpler collision detection (sensing.touching) for non-physics objects.'
            });
        }

        // Check for particle spam
        const particleCreations = (code.match(/particle|spawn|emit/gi) || []).length;
        if (particleCreations > this.MAX_PARTICLES) {
            this.ERRORS.push({
                type: 'PARTICLE_SPAM',
                severity: 'CRITICAL',
                message: `Excessive particle references (${particleCreations}) — max is ${this.MAX_PARTICLES}.`,
                details: 'Uncontrolled particle generation fills memory and causes garbage collection stutters.',
                fix: 'Pool particles instead of creating new ones. Limit max particles on screen at once.'
            });
        }

        // Check collision listener count
        const collisionListeners = (code.match(/physics\.onCollision|sensing\.touching/g) || []).length;
        if (collisionListeners > this.MAX_COLLISION_LISTENERS) {
            this.ERRORS.push({
                type: 'COLLISION_OVERLOAD',
                severity: 'CRITICAL',
                message: `${collisionListeners} collision checks — max is ${this.MAX_COLLISION_LISTENERS}.`,
                details: 'Each collision check is O(n²) complexity. Too many checks cause exponential slowdown.',
                fix: 'Use spatial partitioning or only check collisions for nearby objects. Remove redundant checks.'
            });
        }

        // Check for repeated expensive operations without conditionals
        const expensiveInUpdate = [
            { pattern: /core\.update[\s\S]*?graphics\.loadTexture/g, name: 'graphics.loadTexture', fix: 'Load textures in core.start, not core.update.' },
            { pattern: /core\.update[\s\S]*?audio\.playMusic/g, name: 'audio.playMusic', fix: 'Start music in core.start, not every frame.' },
            { pattern: /core\.update[\s\S]*?shaders\.createCustom/g, name: 'shaders.createCustom', fix: 'Compile shaders once in core.start.' }
        ];

        for (const check of expensiveInUpdate) {
            if (check.pattern.test(code)) {
                this.ERRORS.push({
                    type: 'EXPENSIVE_IN_LOOP',
                    severity: 'CRITICAL',
                    message: `"${check.name}" called inside update loop.`,
                    details: 'This operation is computationally expensive and should never run every frame. It will freeze the game.',
                    fix: check.fix
                });
            }
        }
    }

    // ========== SECURITY & CRASH ANALYSIS ==========

    analyzeSecurity(project) {
        const code = project.code || '';

        // Check for division by zero patterns
        if (/\/\s*0(?!\d)/.test(code) || /divided?\s*by\s*0/i.test(code)) {
            this.ERRORS.push({
                type: 'DIVISION_BY_ZERO',
                severity: 'CRITICAL',
                message: 'Potential division by zero detected.',
                details: 'Division by zero causes JavaScript to return Infinity, which propagates NaN values through physics and rendering, crashing the game silently.',
                fix: 'Add zero-checks before division: if (divisor !== 0) { result = value / divisor; }'
            });
        }

        // Check for null/undefined dereference patterns
        const nullPatterns = [
            { pattern: /\.x\s*\+\s*null|\.y\s*\+\s*null/, desc: 'Adding null to coordinates' },
            { pattern: /Math\.sqrt\s*\(\s*-/, desc: 'Square root of negative number' }
        ];

        for (const np of nullPatterns) {
            if (np.pattern.test(code)) {
                this.ERRORS.push({
                    type: 'NULL_DEREFERENCE',
                    severity: 'CRITICAL',
                    message: `Potential crash: ${np.desc}.`,
                    details: 'This operation produces NaN (Not a Number), which corrupts the entire game state and causes invisible crashes.',
                    fix: 'Validate all values before mathematical operations. Ensure variables are initialized.'
                });
            }
        }

        // Check for eval-like patterns (security risk)
        if (/eval\s*\(|Function\s*\(|new\s+Function/.test(code)) {
            this.ERRORS.push({
                type: 'SECURITY_RISK',
                severity: 'CRITICAL',
                message: 'Forbidden function detected: eval() or Function constructor.',
                details: 'These functions allow arbitrary code execution and are banned from the marketplace for security reasons.',
                fix: 'Remove all eval() and Function() calls. Use FlowScript native commands instead.'
            });
        }

        // Check for external network calls (could be malicious)
        if (/fetch\s*\(|XMLHttpRequest|WebSocket/.test(code)) {
            this.ERRORS.push({
                type: 'NETWORK_FORBIDDEN',
                severity: 'CRITICAL',
                message: 'Unauthorized network requests detected.',
                details: 'Games cannot make external network calls except through the built-in networking.* API. Unauthorized requests may leak user data.',
                fix: 'Use <fs networking.send()> for multiplayer features. Remove all fetch(), XMLHttpRequest, and WebSocket usage.'
            });
        }

        // Check for infinite recursion in action chains
        const actionChains = (code.match(/action\.\w+/g) || []);
        if (actionChains.length > 50) {
            this.ERRORS.push({
                type: 'ACTION_CHAIN_TOO_LONG',
                severity: 'CRITICAL',
                message: `${actionChains.length} action commands — potential action queue overflow.`,
                details: 'Chaining too many actions creates a backlog that never clears, consuming memory indefinitely.',
                fix: 'Limit concurrent actions per node to 5. Use control.stop() to clear queues when needed.'
            });
        }
    }

    // ========== MOBILE OPTIMIZATION ==========

    analyzeMobileOptimization(project) {
        const code = project.code || '';

        // Check for too many simultaneous draw calls (nodes)
        const nodeCreations = (code.match(/sprite\.set\(_:"/g) || []).length;
        if (nodeCreations > this.MAX_NODES_PER_FRAME) {
            this.ERRORS.push({
                type: 'TOO_MANY_NODES',
                severity: 'CRITICAL',
                message: `${nodeCreations} nodes created — max recommended is ${this.MAX_NODES_PER_FRAME}.`,
                details: 'Each node requires a draw call. Mobile GPUs struggle with more than 100 draw calls per frame.',
                fix: 'Batch static objects into fewer nodes. Use tilemaps for backgrounds instead of individual sprites.'
            });
        }

        // Check for shader abuse
        const shaderCalls = (code.match(/shaders\./g) || []).length;
        if (shaderCalls > 3) {
            this.ERRORS.push({
                type: 'SHADER_OVERUSE',
                severity: 'CRITICAL',
                message: `${shaderCalls} shader operations — max is 3 per game.`,
                details: 'Custom shaders are extremely expensive on mobile GPUs and drain battery rapidly.',
                fix: 'Use graphics.setColor() and graphics.setAlpha() for visual effects instead of custom shaders.'
            });
        }

        // Check for unthrottled camera updates
        const cameraUpdates = (code.match(/camera\.(shake|zoom|pan)/g) || []).length;
        if (cameraUpdates > 5) {
            this.WARNINGS.push({
                type: 'CAMERA_SPAM',
                severity: 'WARNING',
                message: `Frequent camera effects (${cameraUpdates}) may cause motion sickness.`,
                fix: 'Add cooldowns between camera shakes. Limit zoom/pan to cutscenes only.'
            });
        }

        // Memory leak detection: nodes created but never removed
        const nodesCreated = (code.match(/sprite\.set\(_:"([^"]+)"/g) || []).map(m => m.match(/"([^"]+)"/)[1]);
        const nodesRemoved = (code.match(/node\.removeFromParent|sprite\.setVisible\([^)]*visible:\s*false/g) || []);

        if (nodesCreated.length > 20 && nodesRemoved.length === 0) {
            this.WARNINGS.push({
                type: 'MEMORY_LEAK_RISK',
                severity: 'WARNING',
                message: `${nodesCreated.length} nodes created but none are ever removed.`,
                details: 'Over long play sessions, accumulated nodes will exhaust memory. This is especially bad on phones with limited RAM.',
                fix: 'Use node.removeFromParent() or sprite.setVisible(visible:false) for temporary objects like bullets or effects.'
            });
        }
    }

    calculateScore() {
        let score = 100;
        score -= this.ERRORS.length * 25;
        score -= this.WARNINGS.length * 5;
        return Math.max(0, score);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlowValidator };
}
