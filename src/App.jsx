import { useState, useEffect } from 'react';
import './index.css';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './components/Dashboard';
import Login from './components/Login'; // Keep for fallback or remove
import Register from './components/Register'; // Keep for fallback or remove
import DatabaseSetup from './components/DatabaseSetup';
import StaffManagement from './components/StaffManagement';
import AuthenticationGateway from './components/AuthenticationGateway';
import Inventory from './components/Inventory';
import POS from './components/POS';
import Transactions from './components/Transactions';
import DeepReports from './components/DeepReports';
import Settings from './components/Settings';
import IntroVideo from './components/IntroVideo';

function App() {
  const [showIntro, setShowIntro] = useState(() => {
    return sessionStorage.getItem('kinita_intro_played') !== 'true';
  });

  const handleIntroEnd = () => {
    sessionStorage.setItem('kinita_intro_played', 'true');
    setShowIntro(false);
  };

  // 0. Booting / Health Check state
  const [isChecking, setIsChecking] = useState(true);

  // 1. Check if database is already configured
  const [isConfigured, setIsConfigured] = useState(false);

  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('kinita_auth') === 'true';
  });

  // New: System Health State
  const [systemHealth, setSystemHealth] = useState({
    serverOnline: false,
    localOnline: !!window.electronAPI,
    dbExists: false,
    systemType: 'local'
  });

  const [hasOwner, setHasOwner] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      console.log("🚀 KINITA: Starting boot sequence...");
      let systemReady = false;
      let sealed = false;
      try {
        let localData = { status: 'error', has_db: false, is_sealed: false };
        let xamppData = { server_online: false, has_db: false };

        // 1. Check Electron/SQLite (Local)
        if (window.electronAPI) {
          console.log("⚙️  Checking local SQLite...");
          try {
            localData = await window.electronAPI.checkSeal();
          } catch (e) {
            console.warn("⚠️  Local SQLite check failed:", e);
          }
        }

        // 2. Check XAMPP/MySQL (Side-channel)
        console.log("🌐 Probing XAMPP/MySQL...");
        const apiBase = window.electronAPI ? 'http://localhost' : '';
        try {
          const response = await fetch(`${apiBase}/kinita/public/api/check_seal.php`);
          xamppData = await response.json();
          console.log("✅ XAMPP check complete:", xamppData.server_online ? "ONLINE" : "OFFLINE");
        } catch (e) {
          // XAMPP Offline
        }

        // --- Source of Truth Selection ---
        let savedMode = localStorage.getItem('kinita_system_mode');

        // Backward compatibility for existing users
        if (!savedMode && localStorage.getItem('kinita_sync_mode') === 'mysql') {
          savedMode = 'master';
          localStorage.setItem('kinita_system_mode', 'master');
        }

        const remoteServerIp = localStorage.getItem('kinita_server_ip');
        let effectiveData = null;
        let systemType = savedMode || 'unconfigured';

        // 1. Remote Satellite Check
        if (savedMode === 'satellite' && remoteServerIp) {
          const cleanIp = remoteServerIp.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
          console.log(`📡 Connecting to cluster node: ${cleanIp}`);
          try {
            const res = await fetch(`http://${cleanIp}/kinita/public/api/check_seal.php`);
            effectiveData = await res.json();
            console.log("✅ Satellite connection established.");
          } catch (e) {
            console.warn(`❌ Failed to connect to satellite at ${cleanIp}`);
          }
        }
        // 2. MySQL / XAMPP Sync Check
        else if (savedMode === 'master' || savedMode === 'mysql') {
          if (xamppData.server_online) {
            effectiveData = xamppData;
          } else {
            console.warn("❌ Master mode selected, but MySQL/XAMPP is offline.");
          }
        }
        // 3. Local SQLite 
        else if (savedMode === 'standalone' || savedMode === 'sqlite') {
          if (window.electronAPI) {
            effectiveData = localData;
          }
        }
        // 4. Default: No Mode Saved (Fresh Install or Auto-Detect)
        else {
          // Do not silently fallback. Force to Database Setup.
          effectiveData = null;
        }

        console.log(`🎯 Active Data Source: ${systemType}`);

        if (effectiveData && effectiveData.status === 'success') {
          // Strict check: Only ready if tables exist. Otherwise we need DatabaseSetup to run init_db.php
          systemReady = effectiveData.has_tables === true || (effectiveData.has_db === true && effectiveData.has_tables !== false);
          // Note: The fallback && effectiveData.has_tables !== false handles legacy sqlite checking not returning has_tables
          sealed = effectiveData.is_sealed;
        }

        // Update Global State
        setSystemHealth({
          serverOnline: xamppData.server_online,
          localOnline: !!window.electronAPI,
          dbExists: effectiveData ? effectiveData.has_db : false,
          systemType: systemType
        });

        // Set Sync Preference for all components
        if (systemType === 'mysql' || systemType === 'satellite' || systemType === 'master') {
          localStorage.setItem('kinita_sync_mode', 'mysql');
        } else {
          localStorage.removeItem('kinita_sync_mode');
        }

        // Only auto-update isConfigured to true if we are in the initial boot sequence (isChecking).
        // If we are currently in DatabaseSetup, DO NOT auto-jump to true. Let the user click "Initialize Store".
        setIsConfigured(prev => {
          if (prev === false && systemReady === true) {
            // If we are booting up, allow it. Otherwise, wait for DatabaseSetup to reload.
            return isChecking ? true : false;
          }
          return systemReady;
        });

        setHasOwner(sealed);

        if (systemReady) {
          localStorage.setItem('kinita_db_configured', 'true');
        } else {
          localStorage.removeItem('kinita_db_configured');
        }

        console.log("🏁 KINITA: Boot sequence finished.");
      } catch (err) {
        console.error("⛔ CRITICAL: Health check failed", err);
        // Only auto-update isConfigured to false if we actually failed to query the DB entirely (though we handled that above).
        setIsConfigured(prev => prev); // Leave it as is to be safe
      } finally {
        setIsChecking(prevChecking => {
          // Safety: If DB is missing but user is logged in, force logout.
          // We must check this inside a state setter to bypass stale closures in the 30s interval.
          // Using localStorage directly ensures we check the true fresh state of auth.
          const freshIsAuthenticated = localStorage.getItem('kinita_auth') === 'true';
          const freshHasOwner = sealed;

          if (!prevChecking && !systemReady && freshIsAuthenticated && !freshHasOwner) {
            console.warn("⚠️ Security: Database missing. Clearing stale session.");
            handleLogout();
          }
          return false;
        });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const [activeTab, setActiveTab] = useState(() => {
    const savedUser = localStorage.getItem('kinita_user');
    const u = savedUser ? JSON.parse(savedUser) : null;
    return u?.role === 'Cashier' ? 'POS' : 'Dashboard';
  });

  // Theme Management
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('kinita_theme') || 'light';
  });

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('kinita_theme', newTheme);
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // User State
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('kinita_user');
    return savedUser ? JSON.parse(savedUser) : { name: 'Guest User', role: 'Cashier', avatar: 'Felix' };
  });

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    localStorage.setItem('kinita_auth', 'true');
    localStorage.setItem('kinita_user', JSON.stringify(userData));
    setActiveTab(userData.role === 'Cashier' ? 'POS' : 'Dashboard');
  };

  const handleSetupComplete = (userData) => {
    setHasOwner(true); // Seal the system
    setIsConfigured(true); // Ensure configured is set
    setUser(userData); // Auto-login as the owner
    setIsAuthenticated(true); // Go to Dashboard
    localStorage.setItem('kinita_auth', 'true');
    localStorage.setItem('kinita_user', JSON.stringify(userData));
    localStorage.setItem('kinita_db_configured', 'true');
    setActiveTab('Dashboard');
  };

  const handleLogout = () => {
    // Clear storage
    localStorage.removeItem('kinita_auth');
    localStorage.removeItem('kinita_user');

    // Force a full reload to ensure clean state and clear any lingering CSS/JS issues
    window.location.reload();
  };

  // 0. Intro Video
  if (showIntro) {
    return <IntroVideo onVideoEnd={handleIntroEnd} />;
  }

  // 0.5. Booting Splash
  if (isChecking) {
    return (
      <div className="boot-splash">
        <div className="loader-orbit">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
        <h2>Loading...</h2>
      </div>
    );
  }

  // 1. Database Configuration / Onboarding (Step 0)
  if (!isConfigured) {
    return (
      <DatabaseSetup
        onConnect={() => {
          setIsConfigured(true);
          localStorage.setItem('kinita_db_configured', 'true');
        }}
        onSetupComplete={handleSetupComplete}
        systemHealth={systemHealth}
        apiBase={window.electronAPI ? 'http://localhost' : ''}
      />
    );
  }

  // 2. Authentication Gateway (Replaces Login/Register)
  if (!isAuthenticated) {
    return (
      <AuthenticationGateway
        key={isAuthenticated ? 'auth-active' : 'auth-login'}
        initialMode={hasOwner ? 'login' : 'setup'}
        onLogin={handleLoginSuccess}
        onSetupComplete={handleSetupComplete}
        systemHealth={systemHealth}
        apiBase={window.electronAPI ? 'http://localhost' : ''}
      />
    );
  }

  const handleUserUpdate = (updates) => {
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('kinita_user', JSON.stringify(updatedUser));
  };

  // 3. Main Application
  return (
    <div className="app-container">
      {/* Background Decor */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>

      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={user.role}
      />

      <main className="main-content">
        <Header
          user={user.name}
          role={user.role}
          onLogout={handleLogout}
          systemHealth={systemHealth}
          theme={theme}
          toggleTheme={toggleTheme}
        />
        <div className="content-area">
          {activeTab === 'Dashboard' && <Dashboard user={user} />}
          {activeTab === 'POS' && <POS user={user} />}
          {activeTab === 'Staff Management' && (
            <StaffManagement />
          )}
          {activeTab === 'Inventory' && <Inventory user={user} />}
          {activeTab === 'Transactions' && <Transactions />}
          {activeTab === 'Deep Reports' && <DeepReports />}
          {activeTab === 'Settings' && <Settings />}
          {(activeTab !== 'Dashboard' && activeTab !== 'Staff Management' && activeTab !== 'Inventory' && activeTab !== 'POS' && activeTab !== 'Transactions' && activeTab !== 'Deep Reports' && activeTab !== 'Settings') && (
            <div className="glass-panel placeholder-panel">
              <h2>Where Antigravity meets {activeTab}</h2>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
