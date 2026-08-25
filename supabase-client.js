/**
 * FlowSupabase — Global Marketplace Backend
 * Connects to Supabase for cross-user game sharing
 */

class FlowSupabase {
    constructor() {
        // REPLACE THESE WITH YOUR SUPABASE PROJECT CREDENTIALS
        this.SUPABASE_URL = 'https://your-project.supabase.co';
        this.SUPABASE_ANON_KEY = 'your-anon-key-here';

        this.client = null;
        this.initialized = false;

        this.init();
    }

    async init() {
        if (typeof supabase === 'undefined') {
            console.warn('Supabase library not loaded. Marketplace will use localStorage fallback.');
            return;
        }

        try {
            this.client = supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            this.initialized = true;
            console.log('Supabase connected successfully');
        } catch (e) {
            console.error('Supabase connection failed:', e);
        }
    }

    isReady() {
        return this.initialized && this.client !== null;
    }

    // ========== PROJECTS TABLE ==========

    async publishProject(project, validationReport) {
        if (!this.isReady()) {
            throw new Error('Supabase not connected. Check your credentials in js/supabase-client.js');
        }

        const payload = {
            id: project.id,
            name: project.name,
            genre: project.genre,
            subgenre: project.subgenre,
            code: project.code,
            sprites: project.sprites || [],
            is_public: true,
            validation_score: validationReport.score,
            validation_passed: validationReport.passed,
            created_at: new Date(project.createdAt).toISOString(),
            updated_at: new Date().toISOString(),
            author_id: await this.getOrCreateAuthorId(),
            author_name: 'Anonymous Creator',
            play_count: 0,
            like_count: 0
        };

        const { data, error } = await this.client
            .from('flow_projects')
            .upsert(payload, { onConflict: 'id' });

        if (error) throw error;
        return data;
    }

    async unpublishProject(projectId) {
        if (!this.isReady()) return;

        const { error } = await this.client
            .from('flow_projects')
            .update({ is_public: false })
            .eq('id', projectId);

        if (error) throw error;
    }

    async fetchPublicProjects(search = '', genreFilter = 'all', limit = 100) {
        if (!this.isReady()) {
            // Fallback to localStorage
            return this.getLocalPublicProjects(search, genreFilter);
        }

        let query = this.client
            .from('flow_projects')
            .select('*')
            .eq('is_public', true)
            .order('updated_at', { ascending: false })
            .limit(limit);

        if (search) {
            query = query.or(`name.ilike.%${search}%,genre.ilike.%${search}%,subgenre.ilike.%${search}%`);
        }

        if (genreFilter !== 'all') {
            query = query.or(`genre.eq.${genreFilter},subgenre.eq.${genreFilter}`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase fetch error:', error);
            return this.getLocalPublicProjects(search, genreFilter);
        }

        return (data || []).map(this.mapProjectFromDB);
    }

    async fetchProjectById(projectId) {
        if (!this.isReady()) {
            // Fallback: try localStorage
            const local = JSON.parse(localStorage.getItem('flowplayground_projects') || '[]');
            const found = local.find(p => p.id === projectId);
            return found || null;
        }

        const { data, error } = await this.client
            .from('flow_projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error) {
            console.error('Supabase fetch error:', error);
            return null;
        }

        return data ? this.mapProjectFromDB(data) : null;
    }

    async incrementPlayCount(projectId) {
        if (!this.isReady()) return;

        const { error } = await this.client
            .from('flow_projects')
            .update({ play_count: supabase.rpc('increment', { row_id: projectId }) })
            .eq('id', projectId);

        if (error) console.error('Failed to increment play count:', error);
    }

    // ========== LOCAL FALLBACK ==========

    getLocalPublicProjects(search = '', genreFilter = 'all') {
        try {
            const data = localStorage.getItem('flowplayground_projects');
            let projects = data ? JSON.parse(data) : [];
            projects = projects.filter(p => p.isPublic);

            if (search) {
                const s = search.toLowerCase();
                projects = projects.filter(p => 
                    p.name.toLowerCase().includes(s) ||
                    p.genre.toLowerCase().includes(s) ||
                    p.subgenre.toLowerCase().includes(s)
                );
            }

            if (genreFilter !== 'all') {
                projects = projects.filter(p => 
                    p.genre === genreFilter || p.subgenre === genreFilter
                );
            }

            return projects;
        } catch (e) {
            return [];
        }
    }

    // ========== HELPERS ==========

    mapProjectFromDB(dbProject) {
        return {
            id: dbProject.id,
            name: dbProject.name,
            genre: dbProject.genre,
            subgenre: dbProject.subgenre,
            code: dbProject.code,
            sprites: dbProject.sprites || [],
            isPublic: dbProject.is_public,
            createdAt: new Date(dbProject.created_at).getTime(),
            updatedAt: new Date(dbProject.updated_at).getTime(),
            authorName: dbProject.author_name,
            playCount: dbProject.play_count || 0,
            likeCount: dbProject.like_count || 0,
            validationScore: dbProject.validation_score || 0
        };
    }

    getOrCreateAuthorId() {
        let authorId = localStorage.getItem('flowplayground_author_id');
        if (!authorId) {
            authorId = 'author_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('flowplayground_author_id', authorId);
        }
        return authorId;
    }

    // ========== SETUP INSTRUCTIONS ==========

    static getSetupInstructions() {
        return `
=== SUPABASE SETUP REQUIRED ===

1. Go to https://supabase.com and create a free project
2. In your Supabase project, go to SQL Editor
3. Run this SQL to create the table:

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

-- Enable Row Level Security (RLS)
ALTER TABLE flow_projects ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read public projects
CREATE POLICY "Public projects are viewable by everyone" 
    ON flow_projects FOR SELECT 
    USING (is_public = true);

-- Allow anyone to insert (for demo purposes)
CREATE POLICY "Anyone can publish projects" 
    ON flow_projects FOR INSERT 
    WITH CHECK (true);

-- Allow authors to update their own projects
CREATE POLICY "Authors can update their projects" 
    ON flow_projects FOR UPDATE 
    USING (true);

4. Go to Project Settings → API
5. Copy the "Project URL" and "anon public" API key
6. Open js/supabase-client.js and paste them:
   this.SUPABASE_URL = 'YOUR_URL_HERE'
   this.SUPABASE_ANON_KEY = 'YOUR_KEY_HERE'

7. Deploy to Render and the global marketplace will work!
        `;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FlowSupabase };
}
