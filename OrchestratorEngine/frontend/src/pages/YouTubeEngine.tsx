import { useState, useRef, useEffect } from 'react'
import { PlaySquare, Loader2, TerminalSquare, Clock, Zap } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function YouTubeEngine() {
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

  // Auto-scroll para o final do terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  // Fetch das vozes customizadas persistidas do VoiceEngine
  useEffect(() => {
    const loadVoices = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/voices')
        if (res.ok) {
          const data = await res.json()
          if (data.data?.length > 0) setCustomVoices(data.data)
        }
      } catch (e) {
        console.error("No F5 voices found.")
      }
    }
    loadVoices()
  }, [])

  useEffect(() => {
    if (storyEndRef.current) {
      storyEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [storyLogs])

  const launchEngine = (zeroShot: boolean = false) => {
    setIsGenerating(true)
    setLogs([])
    setStoryLogs([])

    const effectiveDuration = zeroShot ? 2 : duration
    const modeLabel = zeroShot ? 'ZERO-SHOT DEBUG' : 'Multi-Agent Director'
    setLogs([`[SYSTEM] Triggering Nexus Engine (${modeLabel}) for ${effectiveDuration} minutes.`, '[SYSTEM] Connect via SSE to Port 8000...'])

    // Server-Sent Events (SSE) passing all parameters
    const queryParams = new URLSearchParams({
      duration: effectiveDuration.toString(),
      dialogueRatio: dialogueRatio.toString(),
      rating: contentRating,
      localization: localization,
      voice: voice,
      theme: customTheme,
      isZeroShot: zeroShot.toString()
    })
    const eventSource = new EventSource(`http://localhost:8000/api/engines/youtube/stream?${queryParams.toString()}`)

    eventSource.onmessage = (event) => {
      const data = event.data
      if (data === '[PIPELINE_COMPLETE]') {
        setIsGenerating(false)
        setLogs(prev => [...prev, '[SYSTEM] SSE Connection closed. Pipeline completed successfully.'])
        eventSource.close()
        return
      }

      if (data === '[ERROR] Pipeline failed fatally.') {
        setIsGenerating(false)
        setLogs(prev => [...prev, data, '[SYSTEM] SSE Connection closed due to fatal failure.'])
        eventSource.close()
        return
      }

      if (data.startsWith('[COOLDOWN]')) {
        const seconds = data.split(' ')[1]
        setLogs(prev => {
          const newLogs = [...prev]
          const lastLog = newLogs[newLogs.length - 1]
          if (lastLog?.startsWith('[SYSTEM] Quota recovery active: Resuming in ')) {
            newLogs[newLogs.length - 1] = `[SYSTEM] Quota recovery active: Resuming in ${seconds}s...`
          } else {
            newLogs.push(`[SYSTEM] Quota recovery active: Resuming in ${seconds}s...`)
          }
          return newLogs
        })
        return
      }

      if (data.startsWith('[STORY]')) {
        setStoryLogs(prev => [...prev, data.replace('[STORY]', '').trim()])
        return
      }

      setLogs(prev => [...prev, data])
    }

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err)
      setLogs(prev => [...prev, '[ERROR] Falha de conexão com a API. Motor desligou.'])
      setIsGenerating(false)
      eventSource.close()
    }
  }

  const handleLaunch = () => launchEngine(false)
  const handleZeroShot = () => launchEngine(true)

  return (
    <div className="p-8 w-full max-w-100% mx-auto flex flex-col h-full h-[calc(100vh-2rem)]">
      <header className="mb-6 flex-shrink-0">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <PlaySquare className="text-destructive w-8 h-8" /> YouTube Engine
        </h2>
        <p className="text-muted-foreground w-2/3">
          Controle central do robô Roteirista e TTS. O modelo Gemini gerará a história e o Edge-TTS cuidará da narração neutra. Suporta logs multiplexados em tempo real pela API FastAPI usando Server-Sent Events.
        </p>
      </header>

      <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
        {/* Painel Esquerdo - Controle */}
        <div className="w-1/3 flex flex-col gap-6">
          <Card className="shadow-lg border-border/50">
            <CardHeader>
              <CardTitle>Pipeline Executor</CardTitle>
              <CardDescription>Launch autonomous factory tasks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col gap-2 p-4 bg-secondary/30 border border-border/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">Custom Scenario Override</p>
                    <p className="text-xs text-muted-foreground flex items-center justify-between">
                      Drop specific instructions. Blank randomizes.
                    </p>
                  </div>
                  <Badge variant={customTheme.length > 0 ? "default" : "secondary"}>
                    {customTheme.length > 0 ? "Custom" : "Auto-Random"}
                  </Badge>
                </div>
                <textarea 
                  className="w-full h-24 bg-background border border-border p-2 text-xs rounded-md resize-none shadow-inner"
                  placeholder="Ex: O protagonista é um juiz corrupto que..."
                  maxLength={MAX_THEME_LENGTH}
                  value={customTheme}
                  onChange={e => setCustomTheme(e.target.value)}
                />
                <div className={`text-[10px] text-right font-mono ${customTheme.length >= MAX_THEME_LENGTH - 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {customTheme.length} / {MAX_THEME_LENGTH} limits
                </div>
              </div>

              <div className="flex flex-col gap-2 p-4 bg-secondary/10 border border-border/50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <p className="font-semibold text-sm flex items-center gap-1"><Clock className="w-4 h-4" /> Target Duration</p>
                  <Badge variant="outline">{duration} Minutos</Badge>
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

              {/* Parâmetros Orgânicos */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-secondary/10 border border-border/50 rounded-lg">
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
                
                <div className="p-3 bg-secondary/10 border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">Content Rating</p>
                  <select 
                    value={contentRating} 
                    onChange={e => setContentRating(e.target.value)}
                    className="w-full bg-background border border-border text-xs rounded p-1"
                  >
                    <option value="General">General (Family)</option>
                    <option value="Teen">Teen (Drama/Tense)</option>
                    <option value="R-18">R-18 (Gore/Gritty)</option>
                  </select>
                </div>

                <div className="p-3 bg-secondary/10 border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">Localization</p>
                  <select 
                    value={localization} 
                    onChange={e => setLocalization(e.target.value)}
                    className="w-full bg-background border border-border text-xs rounded p-1"
                  >
                    <option value="Neutro">Neutro (PT-BR)</option>
                    <option value="Paulistano">Paulistano (Mano/Truta)</option>
                    <option value="Nordestino">Nordestino (Sertão)</option>
                  </select>
                </div>

                <div className="p-3 bg-secondary/10 border border-border/50 rounded-lg">
                  <p className="font-semibold text-xs mb-2">TTS Voice</p>
                  <select 
                    value={voice} 
                    onChange={e => setVoice(e.target.value)}
                    className="w-full bg-background border border-border text-xs rounded p-1"
                  >
                    {customVoices.length > 0 ? (
                      <optgroup label="Qwen3-TTS (Autônomo & Nativo)">
                        <option value="auto">🔥 [AUTO] Inteligência do MediaHub Seleciona</option>
                        {customVoices.map(cv => (
                          <option key={cv.filename} value={cv.filename}>[QWEN] {cv.filename.replace('.wav', '')}</option>
                        ))}
                      </optgroup>
                    ) : (
                      <option value="none">Nenhuma voz local injetada no Voice Lab</option>
                    )}
                  </select>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                onClick={handleLaunch}
                disabled={isGenerating}
                className="w-full h-12 shadow-md shadow-primary/20"
              >
                {isGenerating ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <PlaySquare className="w-5 h-5 mr-2" />}
                {isGenerating ? 'Engine Firing...' : 'Generate New Video'}
              </Button>
              <Button
                onClick={handleZeroShot}
                disabled={isGenerating}
                variant="outline"
                className="w-full h-10 border-dashed border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              >
                <Zap className="w-4 h-4 mr-2" />
                Zero-Shot Quick Test (2min, No Director)
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Painel Direito - Terminais Vivos */}
        <div className="w-2/3 flex gap-4 min-h-0">

          {/* Terminal Lógico */}
          <div className="w-1/2 flex flex-col bg-[#0a0a0a] rounded-xl border border-border/50 shadow-2xl overflow-hidden relative">
            <div className="bg-muted px-4 py-2 border-b border-border flex items-center gap-2 text-xs font-mono font-medium text-muted-foreground sticky top-0 z-10 w-full">
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
                  const logColor = isError ? 'text-red-400' : isDirector ? 'text-blue-400' : isCritic ? 'text-yellow-300' : 'text-emerald-400/90'

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
          <div className="w-1/2 flex flex-col bg-[#0a0a0d] rounded-xl border border-border/50 shadow-2xl overflow-hidden relative">
            <div className="bg-primary/10 px-4 py-2 border-b border-primary/20 flex items-center gap-2 text-xs font-mono font-medium text-primary sticky top-0 z-10 w-full">
              <TerminalSquare className="w-4 h-4 text-primary" />
              <span>Story_Stream_tty (Narração)</span>
            </div>

            <div className="flex-1 p-6 font-serif text-base overflow-y-auto space-y-4 text-primary/90 leading-relaxed">
              {storyLogs.length === 0 ? (
                <p className="text-primary/30 italic font-sans text-sm">Aguardando início da redação...</p>
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
