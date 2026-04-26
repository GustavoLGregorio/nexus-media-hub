import { Activity, Database, Network } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function Dashboard() {
  const { data: generations } = useQuery({
    queryKey: ['generations'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:8000/api/generations/youtube')
      return res.data.data
    },
    refetchInterval: 5000 
  })

  // Calcula histórias totais reais
  const totalStories = generations?.length || 0

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
        <p className="text-muted-foreground mt-2">Monitor metrics and orchestrator status.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Stories</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{totalStories}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <Activity className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-500">Idle</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">API Latency</CardTitle>
            <Network className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">~15ms</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Launchpads</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <CardTitle>YouTube Narrative Engine</CardTitle>
              <CardDescription>Generates emotional script, validates anti-AI fingerprint, and creates Base TTS.</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to="/youtube">
                <Button className="w-full">Open Control Panel</Button>
              </Link>
            </CardContent>
          </Card>
          
          <Card className="opacity-60">
            <CardHeader>
              <CardTitle className="text-muted-foreground">TikTok TrueCrime Scraper</CardTitle>
              <CardDescription>Mines subreddits for brutal cases. Hooks optimized for Brainrot retention.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button disabled variant="outline" className="w-full">Offline</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
