# FlowPlayground

A professional 2D game development environment inspired by Xcode and Scratch, powered by **FlowScript** and **FlowCompiler**.

## 🚀 Quick Start

1. Unzip `flow-playground.zip`
2. Open `index.html` in any modern browser
3. No build step needed — it's a static site

## 🌐 Deploy to Render

1. Push this folder to a GitHub repository
2. Go to [render.com](https://render.com) → New → Static Site
3. Connect your GitHub repo
4. Build Command: *(leave empty)*
5. Publish Directory: `/` (root)
6. Click **Create Static Site**

## 🔧 Supabase Setup (REQUIRED for Global Marketplace)

The FlowStore marketplace needs Supabase to show games from **all players worldwide**.

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Create a new project
3. Wait for the database to be provisioned

### Step 2: Create the Database Table
1. In your Supabase project, go to **SQL Editor**
2. Click **New Query**
3. Paste and run this SQL:

```sql
CREATE TABLE flow_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    genre TEXT,
    subgenre TEXT,
    code TEXT NOT NULL,
    sprites JSONB DEFAULT '[]',
    is_public BOOLEAN DEFAULT false,
    validation_score INTEGER DEFAULT 0,
    validation_passed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    author_id TEXT,
    author_name TEXT DEFAULT 'Anonymous Creator',
    play_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0
);

-- Enable Row Level Security
ALTER TABLE flow_projects ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read public projects
CREATE POLICY "Public projects are viewable by everyone" 
    ON flow_projects FOR SELECT 
    USING (is_public = true);

-- Allow anyone to publish
CREATE POLICY "Anyone can publish projects" 
    ON flow_projects FOR INSERT 
    WITH CHECK (true);

-- Allow updates
CREATE POLICY "Authors can update their projects" 
    ON flow_projects FOR UPDATE 
    USING (true);
```

### Step 3: Connect to FlowPlayground
1. In Supabase, go to **Project Settings → API**
2. Copy the **Project URL** and **anon public** API key
3. Open `js/supabase-client.js`
4. Replace these lines:

```javascript
this.SUPABASE_URL = 'https://your-project.supabase.co';
this.SUPABASE_ANON_KEY = 'your-anon-key-here';
```

5. Save and redeploy to Render

## 🛡️ Strict Validation System

Before a game can be published as **Public**, it must pass a rigorous automated check:

### Checks Performed
| Check | Limit | Failure Result |
|-------|-------|----------------|
| **Project Size** | 5 MB max | CRITICAL — Rejected |
| **Code Lines** | 2,000 max | CRITICAL — Rejected |
| **Code Characters** | 100,000 max | CRITICAL — Rejected |
| **Sprites** | 50 max | CRITICAL — Rejected |
| **Sprite Dimensions** | 512×512 max | CRITICAL — Rejected |
| **Sprite Memory** | 3 MB total | CRITICAL — Rejected |
| **Nodes per Frame** | 100 max | CRITICAL — Rejected |
| **Audio per Frame** | 5 max | CRITICAL — Rejected |
| **Physics Objects** | 30 max | CRITICAL — Rejected |
| **Collision Checks** | 20 max | CRITICAL — Rejected |
| **Lag Machines** | No sprite spam in update | CRITICAL — Rejected |
| **Syntax Errors** | 0 allowed | CRITICAL — Rejected |
| **Unclosed Blocks** | 0 allowed | CRITICAL — Rejected |
| **Division by Zero** | Not allowed | CRITICAL — Rejected |
| **Null Dereference** | Not allowed | CRITICAL — Rejected |
| **eval()/Function()** | Forbidden | CRITICAL — Rejected |
| **External Network** | Forbidden | CRITICAL — Rejected |
| **Shader Overuse** | 3 max | CRITICAL — Rejected |

### Validation Results
- **Score 90-100**: ✅ Verified badge on FlowStore
- **Score 70-89**: ⚠️ Published with warnings
- **Score < 70**: ❌ Cannot publish — must fix critical errors

Each error shows:
- **What** is wrong
- **Why** it causes crashes/lag
- **How** to fix it

## 📁 File Structure

```
flow-playground/
├── index.html              # Main SPA
├── css/
│   └── style.css           # Xcode-inspired dark theme
└── js/
    ├── flow-compiler.js    # FlowScript parser + Canvas runtime
    ├── validator.js        # Strict pre-publication analyzer
    ├── supabase-client.js  # Global marketplace backend
    └── app.js              # Project manager, editor, UI
```

## 🎮 FlowScript Example

```flowscript
<fs core.start>
<fs sprite.set(_:"hero" x:196 y:400 width:64 height:64 color:"#0a84ff")>
<fs core.end>

<fs core.update>
<fs input.getAxis(_:"move")>
<fs motion.applyForce(_:"hero" x:move.x*500 y:0)>
<fs core.end>
```

## 📝 License

MIT — Built for the FlowPlayground community.
