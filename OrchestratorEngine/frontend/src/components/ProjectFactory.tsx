import { useState, useEffect, useRef } from 'react';
import { Sparkles, Save, RefreshCw, Cpu, Activity, Play, Terminal } from 'lucide-react';
import { apiClient, WS_BASE } from '../lib/apiClient';

export default function ProjectFactory() {
  const [activeTab, setActiveTab] = useState('config');
  const [models, setModels] = useState<string[]>(['gemini-3.1-flash (Fallback)']);
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash (Fallback)');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [wsStatus, setWsStatus] = useState<'DISCONNECTED' | 'CONNECTED' | 'ACTIVE'>('DISCONNECTED');
  const [logs, setLogs] = useState<string[]>([]);
  
  // Project Config State
  const [projectName, setProjectName] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [pacing, setPacing] = useState('frenetic');
  const [language, setLanguage] = useState('pt-BR');
  const [description, setDescription] = useState('');
  const [includeVocals, setIncludeVocals] = useState(false);

  // Agents State
  const [directorPrompt, setDirectorPrompt] = useState('You are an elite video director...');
  const [writerPrompt, setWriterPrompt] = useState('You are the head writer...');
  const [criticPrompt, setCriticPrompt] = useState('You are the objective technical reviewer. Check for AI clichés, logic flaws, state inconsistencies...');
  const [audiencePrompt, setAudiencePrompt] = useState('You are the subjective critic representing the audience. You can reject or revise the text up to 2 times...');
  const [archivistPrompt, setArchivistPrompt] = useState('You are the archivist, tracking characters and state...');
  const [artistPrompt, setArtistPrompt] = useState('You are the visual artist generating thumbnail and scene prompts...');
  const [composerPrompt, setComposerPrompt] = useState('You are the composer. Analyze soundtrack characteristics and generate prompts for ACE-Step-1.5XL...');

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch Models on mount
  useEffect(() => {
    fetchModels();
    
    // Connect WS
    const ws = new WebSocket(`${WS_BASE}/ws/pipeline`);
    ws.onopen = () => setWsStatus('CONNECTED');
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "LOG" || msg.type === "STATUS") {
          setLogs(prev => [...prev, msg.payload]);
          if (msg.type === "STATUS") setWsStatus('ACTIVE');
        }
      } catch (e) {}
    };
    ws.onclose = () => setWsStatus('DISCONNECTED');
    wsRef.current = ws;
    
    return () => {
      ws.close();
    };
  }, []);

  const fetchModels = async () => {
    setIsRefreshing(true);
    const fetched = await apiClient.getModels();
    if (fetched.length > 0) {
      setModels(fetched);
      setSelectedModel(fetched[0]);
    }
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleAiAssist = async () => {
    if (!projectName || !description) return alert("Please fill Project Name and Description first.");
    setIsGenerating(true);
    try {
      const data = await apiClient.generateAgents({
        name: projectName,
        audience: targetAudience,
        aspectRatio,
        pacing,
        language,
        description,
        includeVocals
      });
      if (data.director) setDirectorPrompt(data.director);
      if (data.writer) setWriterPrompt(data.writer);
      if (data.critic) setCriticPrompt(data.critic);
      if (data.audience) setAudiencePrompt(data.audience);
      if (data.archivist) setArchivistPrompt(data.archivist);
      if (data.artist) setArtistPrompt(data.artist);
      if (data.composer) setComposerPrompt(data.composer);
    } catch (e) {
      alert("Failed to generate: " + e);
    }
    setIsGenerating(false);
  };

  const handleSaveConfig = async () => {
    if (!projectName) return alert("Project Name is required.");
    setIsSaving(true);
    try {
      const config = {
        name: projectName,
        model: selectedModel,
        audience: targetAudience,
        aspectRatio,
        pacing,
        language,
        description,
        includeVocals,
        agents: {
          director: directorPrompt,
          writer: writerPrompt,
          critic: criticPrompt,
          audience: audiencePrompt,
          archivist: archivistPrompt,
          artist: artistPrompt,
          composer: composerPrompt
        }
      };
      await apiClient.saveProject({ name: projectName, config });
      alert("Project Config Saved to Vault!");
    } catch (e) {
      alert("Failed to save: " + e);
    }
    setIsSaving(false);
  };

  const handleLaunchPipeline = () => {
    if (wsRef.current && wsStatus === 'CONNECTED') {
      wsRef.current.send(JSON.stringify({
        action: "START_YOUTUBE_ENGINE",
        config: { duration: 5, dialogueRatio: 30, rating: "Teen", localization: "Neutro", voice: "pt-BR-AntonioNeural", theme: "Tech News", isZeroShot: false }
      }));
    }
  };

  return (
    <div className="flex h-full w-full gap-6 p-6">
      
      {/* LEFT COLUMN: Technical Configuration */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-primary">Project Factory</h2>
            <p className="text-sm font-mono text-muted-foreground mt-1">Configure the engine parameters and output schemas.</p>
          </div>
          <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-sm border border-border/50">
             <div className={`h-2 w-2 rounded-full ${wsStatus === 'CONNECTED' ? 'bg-primary' : wsStatus === 'ACTIVE' ? 'bg-primary animate-pulse' : 'bg-destructive'}`}></div>
             <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Orchestrator {wsStatus}</span>
          </div>
        </div>

        <div className="bg-card rounded-sm p-6 flex flex-col gap-5 border border-border/20 shadow-xl">
          
          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Project Name</label>
              <input 
                type="text" 
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g. TechNewsDaily"
                className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
              />
            </div>
            
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Target Audience</label>
              <input 
                type="text" 
                value={targetAudience}
                onChange={e => setTargetAudience(e.target.value)}
                placeholder="e.g. 18-25 Tech Enthusiasts"
                className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Aspect Ratio</label>
              <select value={aspectRatio} onChange={e => setAspectRatio(e.target.value)} className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none font-mono">
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Pacing</label>
              <select value={pacing} onChange={e => setPacing(e.target.value)} className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none font-mono">
                <option value="frenetic">Frenetic (Fast Cuts)</option>
                <option value="slow_burn">Slow Burn (Documentary)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Language</label>
              <select value={language} onChange={e => setLanguage(e.target.value)} className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none font-mono">
                <option value="pt-BR">Portuguese (pt-BR)</option>
                <option value="en-US">English (en-US)</option>
                <option value="es-ES">Spanish (es-ES)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Core Description</label>
            <textarea 
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the ultimate goal and style of the final videos... (e.g. Brainrot facts about animals with hyper retention editing)"
              className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono resize-none h-20"
            />
          </div>

          <div className="flex items-center gap-3 bg-card border border-border/50 rounded-sm px-3 py-3">
            <input 
              type="checkbox" 
              checked={includeVocals}
              onChange={e => setIncludeVocals(e.target.checked)}
              className="w-4 h-4 bg-background border-border/50 rounded-sm text-primary focus:ring-primary/20"
            />
            <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground cursor-pointer" onClick={() => setIncludeVocals(!includeVocals)}>
              Include Vocals / Lyrics in Music Generation
            </label>
          </div>

          <div className="h-px w-full bg-border/50 my-2"></div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Cpu size={14} className="text-primary"/> Text Engine Model
              </label>
              <button 
                onClick={fetchModels}
                className="text-xs flex items-center gap-1 font-mono text-secondary-foreground hover:text-primary transition-colors"
              >
                <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
                REFRESH API
              </button>
            </div>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} className="bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 appearance-none font-mono">
              {models.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

        </div>
        
        {/* VRAM Live Terminal */}
        <div className="flex-1 bg-background border border-border/30 rounded-sm flex flex-col overflow-hidden">
          <div className="bg-card px-4 py-2 border-b border-border/30 flex items-center gap-2">
            <Terminal size={14} className="text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground">Live Terminal (VRAM-Safe Mode)</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto font-mono text-xs text-secondary-foreground flex flex-col gap-1">
             {logs.length === 0 ? (
               <div className="text-muted-foreground/50 italic">Waiting for pipeline instructions...</div>
             ) : (
               logs.map((log, i) => <div key={i}>{log}</div>)
             )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: AI Agent Personas */}
      <div className="flex-1 flex flex-col gap-6">
        <div className="flex items-center justify-between h-8 mt-2">
          <h3 className="text-lg font-medium text-foreground">Agent Personas</h3>
          <button 
            onClick={handleAiAssist}
            disabled={isGenerating}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 px-3 py-1.5 rounded-sm text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <Sparkles size={14} className={isGenerating ? "animate-spin" : ""} />
            {isGenerating ? "GENERATING..." : "AI ASSIST GENERATE"}
          </button>
        </div>

        <div className="flex flex-col gap-4 bg-card rounded-sm p-4 border border-border/20 shadow-xl flex-1 overflow-y-auto">
          
          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-emerald-500 rounded-full"></span> 1. Director Agent
             </label>
             <textarea 
               value={directorPrompt}
               onChange={e => setDirectorPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>
          
          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-blue-500 rounded-full"></span> 2. Writer Agent
             </label>
             <textarea 
               value={writerPrompt}
               onChange={e => setWriterPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-red-500 rounded-full"></span> 3. Critic Agent (Objective)
             </label>
             <textarea 
               value={criticPrompt}
               onChange={e => setCriticPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-rose-500 rounded-full"></span> 4. Audience Agent (Subjective)
             </label>
             <textarea 
               value={audiencePrompt}
               onChange={e => setAudiencePrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-purple-500 rounded-full"></span> 5. Archivist Agent
             </label>
             <textarea 
               value={archivistPrompt}
               onChange={e => setArchivistPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-amber-500 rounded-full"></span> 6. Artist Agent
             </label>
             <textarea 
               value={artistPrompt}
               onChange={e => setArtistPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
             <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-2">
               <span className="w-2 h-2 bg-cyan-500 rounded-full"></span> 7. Composer Agent
             </label>
             <textarea 
               value={composerPrompt}
               onChange={e => setComposerPrompt(e.target.value)}
               className="bg-background border border-border/50 rounded-sm p-2 text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none font-mono h-24"
             />
          </div>

        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 right-0 left-64 p-6 bg-background/80 backdrop-blur-md border-t border-border/50 flex justify-end items-center z-10 gap-4">
        <button 
          onClick={handleSaveConfig}
          disabled={isSaving}
          className="flex items-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 px-6 py-3 rounded-sm font-bold tracking-wide transition-all border border-border/50 disabled:opacity-50"
        >
          <Save size={18} className={isSaving ? "animate-pulse" : ""} />
          {isSaving ? "SAVING..." : "SAVE CONFIG"}
        </button>
        <button 
          onClick={handleLaunchPipeline}
          className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-3 rounded-sm font-bold tracking-wide transition-all shadow-[0_0_15px_rgba(255,193,7,0.3)] hover:shadow-[0_0_25px_rgba(255,193,7,0.5)]"
        >
          <Play size={18} fill="currentColor" />
          INITIALIZE PIPELINE
        </button>
      </div>

    </div>
  );
}
