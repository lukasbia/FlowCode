# FlowCode

A mobile-first web application for building Discord bots using FlowScript — a custom scripting language. Inspired by Bot Designer for Discord, with a SwiftUI-inspired minimalist white interface.

## Features

- 🔐 Discord OAuth2 Login
- 🤖 Bot Management (max 3 per account)
- 📝 FlowScript Editor with syntax highlighting
- 🧪 Real-time compilation to JavaScript
- 📦 Variable Management
- 🚀 Publishing with safety checks
- 📱 Mobile-first responsive design

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (SPA)
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Hosting**: Render
- **Auth**: Discord OAuth2

---

## Step-by-Step Setup

### Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Choose an organization, name your project (e.g., `flowcode`), and set a secure database password
4. Wait for the project to be created
5. Once created, go to **Project Settings > API**
6. Copy these values:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role secret` → `SUPABASE_SERVICE_KEY`

### Step 2: Run the Database Schema

1. In Supabase, go to the **SQL Editor** (left sidebar)
2. Click **"New query"**
3. Open the `supabase/schema.sql` file from this project
4. Copy ALL the SQL and paste it into the editor
5. Click **"Run"**
6. You should see success messages for all tables

### Step 3: Set Up Discord Application

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications)
2. Your app **Client ID**: `1539956648293040189`
3. Go to **OAuth2 > General**
4. Add Redirect URI:
   - For local testing: `http://localhost:10000/auth/discord/callback`
   - For Render: `https://your-app-name.onrender.com/auth/discord/callback`
5. Save changes
6. Go to **Bot** section
7. Reset/Copy your bot token (you'll need this when adding bots in SwiftBot)

### Step 4: Deploy to Render

#### Option A: Using Render Dashboard (Recommended)

1. Go to [https://dashboard.render.com](https://dashboard.render.com) and sign up
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo (or use "Upload" option)
4. Configure:
   - **Name**: `flowcode`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables:
   ```
   NODE_ENV=production
   DISCORD_CLIENT_ID=1539956648293040189
   DISCORD_CLIENT_SECRET=WkJu4fEe1gc3lRSjYqHfr2YdujFDEYeZ
   DISCORD_REDIRECT_URI=https://flowcode.onrender.com/auth/discord/callback
   SUPABASE_URL=your-supabase-url
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   SESSION_SECRET=generate-a-random-long-string-here
   PORT=10000
   ```
6. Click **"Create Web Service"**

#### Option B: Using render.yaml (Blueprint)

1. Push this repo to GitHub
2. In Render dashboard, click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will read `render.yaml` and auto-configure
5. Fill in the sync=false secrets when prompted

### Step 5: Update Discord Redirect URI

After Render gives you your app URL:
1. Go back to Discord Developer Portal
2. Update the OAuth2 Redirect URI to your actual Render URL
3. Format: `https://your-app-name.onrender.com/auth/discord/callback`

---

## Local Development

```bash
# 1. Clone/navigate to project
cd flowcode

# 2. Install dependencies
npm install

# 3. Create .env file
cp .env.example .env

# 4. Edit .env with your values
# (Use http://localhost:10000 for local redirect URI)

# 5. Run
npm run dev
```

---

## Project Structure

```
flowcode/
├── server.js              # Express backend + API routes
├── package.json           # Dependencies
├── render.yaml            # Render blueprint config
├── .env.example           # Environment template
├── supabase/
│   └── schema.sql         # Database schema
└── public/
    ├── index.html         # Single Page Application
    ├── css/
    │   └── style.css      # SwiftUI-inspired styles
    └── js/
        └── app.js         # Frontend logic + editor
```

---

## FlowScript Language

FlowScript uses dot-notation functions organized by category:

```flowcode
// Event trigger: memberJoin
Discord.Message.send(channelID, "Welcome!")
UI.Embed.setTitle("Hello")
UI.Embed.setDescription("Welcome to the server")
Discord.Message.reply(embed)
```

### Supported Triggers
- `ready` — Bot startup
- `memberJoin` — Member joins server
- `memberLeave` — Member leaves
- `memberBan` / `memberUnban`
- `messageDelete` / `messageUpdate`
- `reactionAdd` / `reactionRemove`
- `channelCreate` / `channelDelete`
- `voiceUpdate` — Voice state changes

### Syntax Highlighting Colors
| Type | Color |
|------|-------|
| Keywords | Magenta |
| System Types | Purple |
| Functions | Blue |
| Numbers/Booleans | Orange |
| Normal Text | Green |
| Comments | Grey |

---

## Security Notes

⚠️ **IMPORTANT**: The Discord Client Secret and bot tokens are sensitive. Never commit `.env` to GitHub. The `.env.example` file is provided as a template only.

- Bot tokens are encrypted at rest in Supabase (use Row Level Security)
- Session secrets should be long random strings
- Always use HTTPS in production

---

## License

MIT — Built with 💙 for the Discord bot community.
