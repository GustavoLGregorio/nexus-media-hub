import { useParams } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Terminal, Play, Square, Settings2, ShieldAlert, Cpu } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

export function ProjectRunner() {
  const { projectName } = useParams({ strict: false }) as any

  const [isRunning, setIsRunning] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  
  // Fake WebSocket simulation for UI purposes until real execution endpoint is wired up
  const wsRef = useRef<WebSocket | null>(null)

  const handleStart = () => {
    setIsRunning(true)
    setLogs(prev => [...prev, `[System] Initializing 7-Agent Pipeline for Project: ${projectName}...`, `[System] Loading configuration from ProjectVault...`])
    
    // Stub
    setTimeout(() => {
       setLogs(prev => [...prev, `[Director] Generating scaffold for ${projectName}...`])
    }, 1500)
  }

  const handleStop = () => {
    setIsRunning(false)
    setLogs(prev => [...prev, `[System] Pipeline aborted by user.`])
  }

  return (
    <div className="flex flex-col h-full w-full p-8 space-y-6 overflow-hidden">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-primary flex items-center gap-3">
            <Play className="text-primary fill-primary w-6 h-6" /> 
            {projectName?.replace(/_/g, ' ') || 'Project Engine'}
          </h2>
          <p className="text-muted-foreground mt-2 text-sm">
            Launch autonomous factory tasks for this project. Powered by Bun BFF and 7-Agent Architecture.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-180px)]">
        {/* Left Panel: Controls */}
        <div className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto pr-2">
          <Card className="bg-surface_container border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Pipeline Executor</CardTitle>
              <CardDescription>Launch autonomous factory tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Custom Scenario Override</label>
                  <span className="text-[10px] text-muted-foreground">Auto-Random</span>
                </div>
                <textarea 
                  placeholder="Ex: O protagonista é um juiz corrupto que..."
                  className="w-full bg-background border border-border/50 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all font-mono resize-none h-24"
                />
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Execution Strategy</label>
                <div className="flex items-center justify-between bg-background border border-border/50 rounded-sm px-3 py-2">
                  <span className="text-sm font-mono">Dataset Auto-Injection</span>
                  <div className="w-8 h-4 bg-primary/20 rounded-full relative">
                    <div className="w-4 h-4 bg-primary absolute right-0 rounded-full shadow-sm"></div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-border/50">
                {!isRunning ? (
                  <Button onClick={handleStart} className="w-full bg-primary text-on_primary font-bold tracking-wide hover:bg-primary/90 flex items-center justify-center gap-2">
                    <Play size={16} /> Generate New Media
                  </Button>
                ) : (
                  <Button onClick={handleStop} variant="destructive" className="w-full font-bold tracking-wide flex items-center justify-center gap-2">
                    <Square size={16} /> Terminate Process
                  </Button>
                )}
                
                <Button variant="ghost" className="w-full mt-2 text-primary hover:text-primary/80 hover:bg-primary/10 text-xs">
                  <Cpu size={14} className="mr-2" /> Zero-Shot Quick Test (No Dataset)
                </Button>
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Panel: Terminal Logs */}
        <div className="lg:col-span-8 flex flex-col h-full bg-surface_container_lowest border border-border/50 rounded-lg overflow-hidden">
          <div className="bg-surface_container border-b border-border/50 px-4 py-2 flex items-center gap-2">
            <Terminal size={14} className="text-primary" />
            <span className="text-xs font-mono text-primary font-semibold">Project_Runner_Stream</span>
          </div>
          <div className="p-4 flex-1 overflow-y-auto font-mono text-xs text-muted-foreground space-y-2">
            {logs.length === 0 ? (
              <p className="opacity-50">Awaiting pipeline execution...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="animate-in fade-in slide-in-from-bottom-1 text-on_surface_variant">
                  {log.includes('[System]') ? <span className="text-emerald-500">{log}</span> : 
                   log.includes('[Director]') ? <span className="text-primary">{log}</span> : 
                   log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
