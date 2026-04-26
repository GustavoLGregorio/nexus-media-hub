import { useState } from 'react';
import { Play, PlaySquare, Film, LayoutDashboard, Settings, Activity, FolderOpen } from 'lucide-react';
import './index.css'; // Make sure styles are applied

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Film size={28} color="#818cf8" />
          <h1 className="glow-text">Nexus Media</h1>
        </div>
        
        <nav className="nav-menu">
          <div 
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'youtube' ? 'active' : ''}`}
            onClick={() => setActiveTab('youtube')}
          >
            <PlaySquare size={20} />
            <span>YouTube Engine</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'tiktok' ? 'active' : ''}`}
            onClick={() => setActiveTab('tiktok')}
          >
            <Film size={20} />
            <span>TikTok TrueCrime</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'generations' ? 'active' : ''}`}
            onClick={() => setActiveTab('generations')}
          >
            <FolderOpen size={20} />
            <span>Generations</span>
          </div>
          <div 
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="top-header glass-panel" style={{ borderTop: 'none', borderLeft: 'none', borderRight: 'none', borderRadius: 0 }}>
          <div className="header-title">
            <h2>Factory Control Hub</h2>
            <p className="header-subtitle">Monitor and command the automated content generation pipelines.</p>
          </div>
          
          <div className="status-badge glass-panel">
            <div className="status-dot"></div>
            Engines Online
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="dashboard-content">
            
            {/* Quick Stats */}
            <div className="stats-section">
              <div className="stat-box glass-panel">
                <span className="stat-label">Videos Generated</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-box glass-panel">
                <span className="stat-label">Active Scrapers</span>
                <span className="stat-value">0</span>
              </div>
              <div className="stat-box glass-panel">
                <span className="stat-label">Token Cost (Today)</span>
                <span className="stat-value">$0.00</span>
              </div>
            </div>

            <h3 style={{ fontSize: '1.4rem', marginTop: '16px' }}>Active Engines</h3>
            
            <div className="engines-grid">
              
              {/* YouTube Engine Card */}
              <div className="engine-card glass-panel">
                <div className="engine-header">
                  <div className="engine-info">
                    <div className="engine-icon youtube">
                      <PlaySquare size={24} />
                    </div>
                    <h3>YouTube Stories</h3>
                    <p>Moral-driven narratives with redemption arcs. Edge-TTS enabled.</p>
                  </div>
                </div>
                
                <div className="card-footer">
                  <span className="stat-label" style={{ color: '#10b981' }}>Idle</span>
                  <button className="btn-primary">
                    <Play size={16} fill="white" /> Launch Pipeline
                  </button>
                </div>
              </div>

              {/* TikTok Engine Card */}
              <div className="engine-card glass-panel" style={{ opacity: 0.6 }}>
                <div className="engine-header">
                  <div className="engine-info">
                    <div className="engine-icon tiktok">
                      <Film size={24} />
                    </div>
                    <h3>TikTok TrueCrime</h3>
                    <p>Viral dark incidents scraped daily from deep web / Reddit.</p>
                  </div>
                </div>
                
                <div className="card-footer">
                  <span className="stat-label" style={{ color: '#f59e0b' }}>Under Construction</span>
                  <button className="btn-secondary" disabled>
                    Config Setup
                  </button>
                </div>
              </div>

              {/* Advanced UI Builder Card */}
              <div className="engine-card glass-panel">
                <div className="engine-header">
                  <div className="engine-info">
                    <div className="engine-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#818cf8' }}>
                      <Activity size={24} />
                    </div>
                    <h3>ComfyUI Worker Node</h3>
                    <p>Remote API connector for latent video generations (I2V / T2V).</p>
                  </div>
                </div>
                
                <div className="card-footer">
                  <span className="stat-label" style={{ color: '#ef4444' }}>Offline</span>
                  <button className="btn-secondary">
                    Ping API
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
