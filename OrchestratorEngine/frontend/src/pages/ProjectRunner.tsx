import { useParams } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Terminal, Play, Square, TerminalSquare, Clock, Zap, Loader2 } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { WS_BASE } from '../lib/apiClient'

export function ProjectRunner() {
  const { projectName } = useParams({ strict: false }) as any

  const [isGenerating, setIsGenerating] = useState(false)
  const [duration, setDuration] = useState(5)
  const [dialogueRatio, setDialogueRatio] = useState(30)
  const [contentRating, setContentRating] = useState('Teen')
  const [localization, setLocalization] = useState('Neutro')
  const [voice, setVoice] = useState('auto')
  
  const [customVoices, setCustomVoices] = useState<any[]>([])
  const [customTheme, setCustomTheme] = useState('')
  const MAX_THEME_LENGTH = 1500

  const [logs, setLogs] = useState<string[]>([])
  const [storyLogs, setStoryLogs] = useState<string[]>([])
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const storyEndRef = useRef<HTMLDivElement>(null)
  
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  useEffect(() => {
    if (storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [storyLogs])

  useEffect(() => {
    const loadVoices = async () => {
      try {
        // Fallback or read from our API
        const res = await fetch('http://localhost:8000/api/voices')
        if (res.ok) {
          const data = await res.json()
          if (data.data?.length > 0) setCustomVoices(data.data)
        }
      } catch (e) {
        console.error("No voices found.")
      }
    }
    loadVoices()
  }, [])

  const launchEngine = (zeroShot: boolean = false) => {
    setIsGenerating(true)
    setLogs([])
    setStoryLogs([])

    const effectiveDuration = zeroShot ? 2 : duration
    const modeLabel = zeroShot ? 'ZERO-SHOT DEBUG' : 'Multi-Agent Director'
    setLogs([
      `[SYSTEM] Triggering Pipeline (${modeLabel}) for ${projectName}.`,
      `[SYSTEM] Connecting to WebSocket...`
    ])

    const ws = new WebSocket(`${WS_BASE}/ws/pipeline`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        action: "START_PROJECT_ENGINE",
        config: {
          projectName,
          duration: effectiveDuration,
          dialogueRatio,
          rating: contentRating,
          localization,
          voice,
          theme: customTheme,
          isZeroShot: zeroShot
        }
      }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "LOG" || msg.type === "STATUS") {
          const data = msg.payload
          
          if (data === '[PIPELINE_COMPLETE]') {
            setIsGenerating(false)
            setLogs(prev => [...prev, '[SYSTEM] Pipeline completed successfully.'])
            ws.close()
            return
          }

          if (data === '[ERROR] Pipeline failed fatally.') {
            setIsGenerating(false)
            setLogs(prev => [...prev, data, '[SYSTEM] Connection closed due to fatal failure.'])
            ws.close()
            return
          }

          if (data.startsWith('[STORY]') || data.startsWith('Act Instruction:') || data.startsWith('Current Archivist State:')) {
            setStoryLogs(prev => [...prev, data.replace('[STORY]', '').trim()])
            return
          }

          setLogs(prev => [...prev, data])
        }
      } catch (e) {
         // handle
      }
    }

    ws.onclose = () => {
      setIsGenerating(false)
    }
    
    ws.onerror = (err) => {
      console.error("WS Error:", err)
      setLogs(prev => [...prev, '[ERROR] Falha de conexão com a API. Motor desligou.'])
      setIsGenerating(false)
      ws.close()
    }
  }

  const handleStop = () => {
    setIsGenerating(false)
    if (wsRef.current) {
      wsRef.current.close()
    }
    setLogs(prev => [...prev, `[System] Pipeline aborted by user.`])
  }

  return (
    <div className="p-8 w-full max-w-100% mx-auto flex flex-col h-full h-[calc(100vh-2rem)]">
      <header className="mb-6 flex-shrink-0">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Play className="text-primary fill-primary w-8 h-8" /> {projectName?.replace(/_/g, ' ') || 'Project Engine'}
        </h2>
        <p className="text-muted-foreground w-2/3">
          Launch autonomous factory tasks for this project. Powered by Bun BFF and 7-Agent Architecture.
        </p>
      </header>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Painel Esquerdo - Controle */}
        <div className="w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
          <Card className="shadow-lg border-border/50 bg-card">
            <CardHeader>
              <CardTitle>Pipeline Executor</CardTitle>
              <CardDescription>Launch autonomous factory tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-2 p-4 bg-background border border-border/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">Custom Scenario Override</p>
                    <p className="text-xs text-muted-foreground">
                      Drop specific instructions. Blank randomizes.
                    </p>
                  </div>
                  <Badge variant={customTheme.length > 0 ? "default" : "secondary"}>
                    {customTheme.length > 0 ? "Custom" : "Auto-Random"}
                  </Badge>
                </div>
                <textarea 
                  className="w-full h-24 bg-background border border-border p-2 text-xs rounded-md resize-none shadow-inner font-mono text-foreground focus:outline-none"
                  placeholder="Ex: O protagonista é um juiz corrupto que..."
                  maxLength={MAX_THEME_LENGTH}
                  value={customTheme}
                  onChange={e => setCustomTheme(e.target.value)}
                />
                <div className={`text-[10px] text-right font-mono ${customTheme.length >= MAX_THEME_LENGTH - 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {customTheme.length} / {MAX_THEME_LENGTH} limits
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-background border border-border/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-sm flex items-center gap-1"><Clock className="w-4 h-4 text-primary" /> Target Duration</p>
                  <Badge variant="outline" className="text-primary border-primary/20">{duration} Minutos</Badge>
                </div>
                <input
                  type="range"
                  min="2"
                  max="30"
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A {duration}m video = ~{Math.max(3, duration)} Multi-Agent Acts via Director.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-background border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">Dialogue Ratio ({dialogueRatio}%)</p>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    step="10"
                    value={dialogueRatio}
                    onChange={(e) => setDialogueRatio(parseInt(e.target.value))}
                    className="w-full accent-emerald-500"
                  />
                </div>
                
                <div className="p-3 bg-background border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">Content Rating</p>
                  <select 
                    value={contentRating} 
                    onChange={e => setContentRating(e.target.value)}
                    className="w-full bg-background text-foreground border border-border text-xs rounded p-1 focus:outline-none"
                  >
                    <option value="General">General (Family)</option>
                    <option value="Teen">Teen (Drama/Tense)</option>
                    <option value="R-18">R-18 (Gore/Gritty)</option>
                  </select>
                </div>

                <div className="p-3 bg-background border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">Localization</p>
                  <select 
                    value={localization} 
                    onChange={e => setLocalization(e.target.value)}
                    className="w-full bg-background text-foreground border border-border text-xs rounded p-1 focus:outline-none"
                  >
                    <option value="Neutro">Neutro (PT-BR)</option>
                    <option value="Paulistano">Paulistano (Mano/Truta)</option>
                    <option value="Nordestino">Nordestino (Sertão)</option>
                  </select>
                </div>

                <div className="p-3 bg-background border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">TTS Voice</p>
                  <select 
                    value={voice} 
                    onChange={e => setVoice(e.target.value)}
                    className="w-full bg-background text-foreground border border-border text-xs rounded p-1 focus:outline-none"
                  >
                    {customVoices.length > 0 ? (
                      <optgroup label="Qwen3-TTS (Autônomo & Nativo)">
                        <option value="auto">🔥 [AUTO] Inteligência do MediaHub</option>
                        {customVoices.map(cv => (
                          <option key={cv.filename} value={cv.filename}>[QWEN] {cv.filename.replace('.wav', '')}</option>
                        ))}
                      </optgroup>
                    ) : (
                      <option value="none">Nenhuma voz local injetada</option>
                    )}
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              {!isGenerating ? (
                <Button onClick={() => launchEngine(false)} className="w-full h-12 bg-primary text-primary-foreground font-bold tracking-wide hover:bg-primary/90 flex items-center justify-center gap-2">
                  <Play size={16} /> Generate New Media
                </Button>
              ) : (
                <Button onClick={handleStop} variant="destructive" className="w-full h-12 font-bold tracking-wide flex items-center justify-center gap-2">
                  <Square size={16} /> Terminate Process
                </Button>
              )}
              
              <Button onClick={() => launchEngine(true)} disabled={isGenerating} variant="ghost" className="w-full mt-2 text-primary hover:text-primary/80 hover:bg-primary/10 text-xs">
                <Zap size={14} className="mr-2" /> Zero-Shot Quick Test (2min, No Director)
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Painel Direito - Terminais Vivos */}
        <div className="w-2/3 flex gap-4 min-h-0">

          {/* Terminal Lógico */}
          <div className="w-1/2 flex flex-col bg-background rounded-xl border border-border/50 shadow-2xl overflow-hidden relative">
            <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground sticky top-0 z-10 w-full">
              <TerminalSquare className="w-4 h-4 text-emerald-500" />
              <span>Logic_Stream_tty (Cognição)</span>
              {isGenerating && <span className="ml-auto flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> REC</span>}
            </div>

            <div className="flex-1 p-6 font-mono text-sm overflow-y-auto space-y-1">
              {logs.length === 0 ? (
                <p className="text-muted-foreground/40 italic">Matriz lógica ociosa...</p>
              ) : (
                logs.map((log, i) => {
                  const isError = log.includes('[ERROR]') || log.includes('Falha')
                  const isCritic = log.includes('[CRITIC]') || log.includes('[AUDIENCE]')
                  const isDirector = log.includes('[DIRECTOR]')
                  const logColor = isError ? 'text-red-400' : isDirector ? 'text-primary' : isCritic ? 'text-yellow-500' : 'text-emerald-500/90'

                  return (
                    <div key={i} className={`whitespace-pre-wrap break-words pb-1 border-b border-border/20 last:border-0 ${logColor}`}>
                      <span className="opacity-40 mr-3 text-[10px]">{new Date().toLocaleTimeString('pt-BR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      {log}
                    </div>
                  )
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Terminal Literário (História) */}
          <div className="w-1/2 flex flex-col bg-background rounded-xl border border-border/50 shadow-2xl overflow-hidden relative">
            <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex items-center gap-2 text-xs font-mono font-medium text-primary sticky top-0 z-10 w-full">
              <TerminalSquare className="w-4 h-4 text-primary" />
              <span>Story_Stream_tty (Narração)</span>
            </div>

            <div className="flex-1 p-6 font-serif text-base overflow-y-auto space-y-4 text-foreground leading-relaxed">
              {storyLogs.length === 0 ? (
                <p className="text-muted-foreground/30 italic font-sans text-sm">Aguardando início da redação...</p>
              ) : (
                storyLogs.map((log, i) => (
                  <div key={i} className="whitespace-pre-wrap break-words bg-primary/5 p-4 rounded border border-primary/10">
                    <span className="block text-primary/50 text-xs font-mono mb-2 uppercase border-b border-primary/10 pb-1">
                      ACT {i + 1}
                    </span>
                    {log}
                  </div>
                ))
              )}
              <div ref={storyEndRef} />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
