import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mic, UploadCloud, FileAudio, Trash2, X, PlayCircle } from 'lucide-react'
import { Badge } from "@/components/ui/badge"

interface VoiceData {
  id: string
  filename: string
  ref_text: string
  gender: string
  age: string
  traits: string
}

export function VoiceLab() {
  const [voices, setVoices] = useState<VoiceData[]>([])
  const [isDragActive, setIsDragActive] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Modal states
  const [stagedFile, setStagedFile] = useState<File | null>(null)
  const [stagedUrl, setStagedUrl] = useState<string>("")
  const [refText, setRefText] = useState("")
  const [gender, setGender] = useState("unknown")
  const [age, setAge] = useState("unknown")
  const [traits, setTraits] = useState("")

  const fetchVoices = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/voices')
      if (res.ok) {
        const data = await res.json()
        setVoices(data.data || [])
      }
    } catch (e) {
      console.error("Failed to fetch voices")
    }
  }

  useEffect(() => {
    fetchVoices()
  }, [])

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0]
      // Accept wide range, but explicitly notify user
      setStagedFile(file)
      setStagedUrl(URL.createObjectURL(file))
    }
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      setStagedFile(file)
      setStagedUrl(URL.createObjectURL(file))
    }
  }

  const uploadVoice = async () => {
    if (!stagedFile) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', stagedFile)
    formData.append('ref_text', refText)
    formData.append('gender', gender)
    formData.append('age', age)
    formData.append('traits', traits)
    
    try {
      const res = await fetch('http://localhost:8000/api/voices/upload', {
        method: 'POST',
        body: formData
      })
      if (res.ok) {
        cancelStaging()
        fetchVoices()
      }
    } catch (e) {
      console.error(e)
      alert("Upload failed")
    }
    setUploading(false)
  }

  const cancelStaging = () => {
    setStagedFile(null)
    setStagedUrl("")
    setRefText("")
    setGender("unknown")
    setAge("unknown")
    setTraits("")
  }

  return (
    <div className="p-8 w-full max-w-4xl mx-auto flex flex-col h-full overflow-y-auto">
      <header className="mb-6 flex-shrink-0">
        <h2 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <Mic className="text-blue-500 w-8 h-8" /> Voice Lab
        </h2>
        <p className="text-muted-foreground w-2/3">
          Upload áudios ou vídeos curtos. O MediaHub converterá automaticamente em .wav interno e injetará no motor Qwen3-TTS (Emotional Acting). A extração Zero-Shot puxará o sotaque. Você pode guiá-lo usando Linguagem Natural (Ex: Narrador calmo, sombrio) diretamente no painel de Roteirista sem poluir o script com fake-tags.
        </p>
      </header>
      
      {/* Upload & Staging Area */}
      {!stagedFile ? (
          <Card className="border-border/50 mb-8 bg-black/40 shadow-xl">
            <CardHeader>
              <CardTitle>Injeção de Nova Referência Vocal</CardTitle>
              <CardDescription>Solte arquivos .mp4, .m4a, .mp3 ou .wav aqui.</CardDescription>
            </CardHeader>
            <CardContent>
              <div 
                className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${isDragActive ? 'border-primary bg-primary/10' : 'border-border/50 hover:bg-white/5'} cursor-pointer`}
                onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
                onDragLeave={() => setIsDragActive(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById('voice-upload')?.click()}
              >
                <input 
                  id="voice-upload" 
                  type="file" 
                  accept="audio/*,video/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                />
                  <div className="flex flex-col items-center justify-center text-muted-foreground hover:text-foreground">
                    <UploadCloud className="w-12 h-12 mb-4 opacity-50" />
                    <p className="font-semibold text-lg mb-1">Arraste mídia de base aqui...</p>
                    <p className="text-sm opacity-60">Será convertido automaticamente em .WAV pelo FFmpeg de fundo.</p>
                  </div>
              </div>
            </CardContent>
          </Card>
      ) : (
          <Card className="border-primary/50 mb-8 bg-black/60 shadow-2xl relative overflow-hidden ring-1 ring-primary/40">
            <div className="absolute top-4 right-4">
               <button onClick={cancelStaging} className="p-2 bg-red-500/20 text-red-400 rounded-full hover:bg-red-500/40"><X className="w-4 h-4"/></button>
            </div>
            
            <CardHeader>
              <CardTitle className="text-primary flex gap-2 items-center"><PlayCircle className="w-5 h-5"/> Mídia Carregada e Pronta</CardTitle>
              <CardDescription>{stagedFile.name} ({(stagedFile.size / 1024 / 1024).toFixed(2)} MB)</CardDescription>
            </CardHeader>
            
            <CardContent className="grid grid-cols-2 gap-6">
               <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
                  <span className="text-sm text-muted-foreground">Reprodutor de Transcrição:</span>
                  {stagedFile.type.includes("video") ? (
                    <video src={stagedUrl} controls className="w-full rounded-md border border-white/10 bg-black/50" />
                  ) : (
                    <audio src={stagedUrl} controls className="w-full ring-1 ring-white/10 rounded-md" />
                  )}
                  
                  <div className="flex gap-2 mt-4">
                     <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Gênero</label>
                        <select className="w-full bg-white/5 border border-white/10 p-2 rounded text-sm outline-none" value={gender} onChange={e=>setGender(e.target.value)}>
                            <option value="unknown">Desconhecido</option>
                            <option value="male">Masculino</option>
                            <option value="female">Feminino</option>
                        </select>
                     </div>
                     <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">Idade Aparente</label>
                        <select className="w-full bg-white/5 border border-white/10 p-2 rounded text-sm outline-none" value={age} onChange={e=>setAge(e.target.value)}>
                            <option value="unknown">Desconhecido</option>
                            <option value="child">Criança</option>
                            <option value="young">Jovem (18-35)</option>
                            <option value="adult">Adulto (35-55)</option>
                            <option value="elder">Idoso (55+)</option>
                        </select>
                     </div>
                  </div>
                  
                  <div className="mt-2">
                     <label className="text-xs text-muted-foreground mb-1 block">Descritores Físicos (Ex: Seria, Aveludada, Sotaque Carioca)</label>
                     <input 
                        type="text" 
                        value={traits}
                        onChange={e=>setTraits(e.target.value)}
                        placeholder="Adjetivos vocais..." 
                        className="w-full bg-white/5 border border-white/10 p-2 rounded text-sm outline-none"
                     />
                  </div>
               </div>
               
               <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
                  <label className="text-sm font-semibold flex items-center gap-2">
                     Reference Text (Opcional) 
                     <span className="text-xs font-normal text-muted-foreground ml-auto bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded">Para fixar peculiaridades de dicionário no RAG</span>
                  </label>
                  <textarea 
                     value={refText}
                     onChange={e=>setRefText(e.target.value)}
                     className="w-full flex-1 bg-white/5 border border-white/10 p-3 text-sm rounded outline-none resize-none focus:border-primary/50"
                     placeholder="Dê play no media ao lado e digite exatamente o que a pessoa está dizendo neste arquivo para ancorar a transcrição..."
                  />
                  
                  <button 
                    onClick={uploadVoice} 
                    disabled={uploading || !refText.trim()} 
                    className="w-full bg-primary text-black font-bold p-3 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/80 disabled:opacity-50 transition-all mt-2"
                  >
                     {uploading ? "Convertendo no FFmpeg & Enviando..." : "Injetar Mídia no MediaHub"}
                  </button>
               </div>
            </CardContent>
          </Card>
      )}

      <h3 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-border/50 pb-2">
        <FileAudio className="w-5 h-5" /> Banco Vocal Autoral ({voices.length} Identidades)
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {voices.map(v => (
          <div key={v.filename} className="bg-secondary/20 border border-border/50 rounded-lg p-5 flex flex-col justify-between items-start hover:border-primary/50 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 opacity-10">
                <Mic className="w-16 h-16"/>
            </div>
          
            <div className="flex flex-col w-full mb-3 relative z-10">
              <p className="font-bold text-lg truncate w-full border-b border-white/5 pb-2 mb-2" title={v.filename}>
                 {v.filename.replace('.wav','')}
              </p>
              
              <div className="flex gap-2 mb-3">
                 <Badge variant="outline" className="text-[10px] bg-blue-500/10 border-blue-500/20">{v.gender}</Badge>
                 <Badge variant="outline" className="text-[10px] bg-green-500/10 border-green-500/20">{v.age}</Badge>
              </div>
              
              {v.traits && (
                  <p className="text-xs text-muted-foreground italic mb-2">"{v.traits}"</p>
              )}
              
              {v.ref_text && (
                  <div className="text-[10px] text-white/50 bg-black/40 p-2 rounded line-clamp-3">
                      {v.ref_text}
                  </div>
              )}
            </div>
          </div>
        ))}
        {voices.length === 0 && (
          <p className="text-muted-foreground text-sm col-span-3 italic">Nenhuma identidade inserida. Base vazia.</p>
        )}
      </div>

    </div>
  )
}

