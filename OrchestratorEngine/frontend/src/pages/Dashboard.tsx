import { Activity, Database, Network } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:8000/api/health')
      return res.data
    },
    refetchInterval: 10000 
  })

  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await axios.get('http://localhost:8000/api/projects')
      return res.data.data
    }
  })

  const totalProjects = projects?.length || 0

  return (
    <div className="flex flex-col h-full overflow-y-auto w-full p-8 space-y-8">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">System Overview</h2>
        <p className="text-muted-foreground mt-2">Monitor metrics and orchestrator status.</p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Projects</CardTitle>
            <Database className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{totalProjects}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <Activity className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-emerald-500">{stats?.status === "online" ? "Online" : "Idle"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Orchestrator</CardTitle>
            <Network className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary capitalize">{stats?.orchestrator || "Bun"}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-xl font-bold mb-4">Project Vault</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects?.map((proj: any) => (
            <Card key={proj.name} className="hover:border-primary/50 transition-colors bg-surface_container_low group cursor-pointer relative overflow-hidden flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg text-primary">{proj.name.replace(/_/g, ' ')}</CardTitle>
                  <span className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-1 rounded-sm border border-primary/20">
                    {proj.model.replace("gemini-", "").replace("-preview", "")}
                  </span>
                </div>
                <CardDescription className="line-clamp-2 mt-2 h-10">
                  {proj.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="mt-auto">
                <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground mb-4">
                  <span>{proj.aspectRatio}</span>
                  <span>•</span>
                  <span className="capitalize">{proj.pacing}</span>
                </div>
                <Link to={`/project/${proj.name}`}>
                  <Button className="w-full bg-surface_container hover:bg-primary hover:text-on_primary transition-all text-primary border border-primary/20 group-hover:border-primary/50">
                    Open Engine Console
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
          
          {totalProjects === 0 && (
            <div className="col-span-full py-12 text-center border border-dashed border-border/50 rounded-lg">
              <p className="text-muted-foreground font-mono">No projects found in ProjectVault.</p>
              <Link to="/factory">
                <Button variant="outline" className="mt-4 text-primary border-primary/50">Go to Project Factory</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
