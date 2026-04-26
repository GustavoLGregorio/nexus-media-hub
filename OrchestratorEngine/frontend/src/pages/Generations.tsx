import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { FolderOpen, Clock, Tag, Mic, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type GenerationData = {
  timestamp: number
  hash_id: string
  folder_name: string
  platform: string
  status: string
  estimated_duration_seconds: number
  bgm_mood: string
  tts_voice: string
  agent_validation_log: string
}

export function Generations() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['generations'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:8000/api/generations/youtube')
      return res.data.data as GenerationData[]
    },
    refetchInterval: 5000 
  })

  return (
    <div className="p-8 w-full h-full overflow-y-auto">
      <header className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-2">
          <FolderOpen className="text-primary w-8 h-8" /> Histórico de Gerações
        </h2>
        <p className="text-muted-foreground">Pastas estruturadas salvas localmente e mapeadas pelo servidor FastAPI.</p>
      </header>

      {isLoading && <p className="text-muted-foreground animate-pulse">Carregando discos locais...</p>}
      {error && <p className="text-destructive font-medium">Erro ao carregar dados do Backend (porta 8000 aberta?)</p>}

      <div className="flex flex-col gap-6 max-w-4xl">
        {data?.length === 0 && (
          <div className="p-12 border border-border border-dashed rounded-xl text-center text-muted-foreground w-full">
            Nenhuma história gerada encontrada. Rode o motor do YouTube primeiro.
          </div>
        )}

        {data?.map((gen) => (
          <Card key={gen.hash_id} className="hover:border-primary/40 transition-colors">
            <CardHeader className="flex flex-row items-start justify-between pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  ID: {gen.hash_id.toUpperCase()} 
                  <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">{gen.platform}</Badge>
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-1">/generations/{gen.folder_name}</CardDescription>
              </div>
              <Badge variant="secondary" className="px-3 py-1 font-semibold">{gen.status}</Badge>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-x-6 gap-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="w-4 h-4"/> Est. {gen.estimated_duration_seconds} segs.</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mic className="w-4 h-4"/> {gen.tts_voice}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Tag className="w-4 h-4"/> BGM: {gen.bgm_mood}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="w-4 h-4"/> Time: {new Date(gen.timestamp * 1000).toLocaleString('pt-BR')}</div>
              </div>

              <div className="bg-secondary/30 p-4 rounded-md border text-sm">
                <span className="font-semibold text-muted-foreground uppercase tracking-widest text-[10px] block mb-2">Logs do Validador de IA</span>
                <p className="italic leading-relaxed text-foreground/90">
                  "{gen.agent_validation_log}"
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
