import React, { useState, useEffect } from 'react';
import { Database, Server, HardDrive, ShieldCheck, Zap, CheckCircle, Boxes, Activity, Globe, Cpu, Wifi } from 'lucide-react';
import './DatabaseSetup.css';

const DatabaseSetup = ({ onConnect, onSetupComplete, systemHealth, apiBase }) => {
    const [step, setStep] = useState(0); // 0: Mode Selection, 1: Check, 2: Build, 3: Ready, 4: Reg
    const [mode, setMode] = useState(null); // 'standalone' | 'master' | 'satellite'
    const [remoteIp, setRemoteIp] = useState('');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('Scanning Environment...');
    const [error, setError] = useState(null);
    const [logs, setLogs] = useState([]);
    const [isSealing, setIsSealing] = useState(false);
    const [regError, setRegError] = useState('');

    const handleModeSelect = (selectedMode) => {
        setMode(selectedMode);
        localStorage.setItem('kinita_system_mode', selectedMode);
        if (selectedMode !== 'satellite') {
            localStorage.removeItem('kinita_server_ip');
            setStep(1);
        }
    };

    const handleConnectSatellite = () => {
        if (!remoteIp) return;

        // Strip out existing http:// or https:// if user pasted a full URL
        const cleanIp = remoteIp.replace(/^https?:\/\//i, '').replace(/\/+$/, '');

        localStorage.setItem('kinita_server_ip', cleanIp);
        localStorage.setItem('kinita_system_mode', 'satellite');
        setStep(1);
    };

    useEffect(() => {
        // Step 1: System Check Animation
        if (step === 1) {
            const timer = setTimeout(() => {
                setStep(2);
                setStatusText('Injecting Schemas...');
            }, 3000);
            return () => clearTimeout(timer);
        }

        // Step 2: Database Build & API Call
        if (step === 2) {
            let interval;

            const initDatabase = async () => {
                try {
                    let savedIp = localStorage.getItem('kinita_server_ip');
                    if (savedIp) savedIp = savedIp.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
                    const effectiveApiBase = savedIp ? `http://${savedIp}/kinita/public/api` : (apiBase ? `${apiBase}/kinita/public/api` : '/kinita/public/api');

                    setLogs(prev => [...prev, "Checking system requirements..."]);
                    let result;

                    // Master and Satellite modes use MySQL/PHP, Standalone uses SQLite
                    const useMySQL = savedIp || mode === 'master' || !window.electronAPI;

                    if (useMySQL) {
                        const response = await fetch(`${effectiveApiBase}/init_db.php`);
                        const text = await response.text();
                        try {
                            result = JSON.parse(text);
                        } catch (e) {
                            throw new Error("Invalid response from server");
                        }
                    } else if (window.electronAPI) {
                        result = await window.electronAPI.initDb();
                    }

                    if (result.status === 'success') {
                        if (result.stages) {
                            for (const stage of result.stages) {
                                setLogs(prev => [...prev, stage]);
                                setStatusText(stage);
                                await new Promise(r => setTimeout(r, 600));
                            }
                        } else {
                            setLogs(prev => [...prev, "Injecting Schemas...", "Creating Tables..."]);
                        }
                        setStatusText('Finalizing...');
                        setProgress(100);
                    } else {
                        throw new Error(result.message);
                    }
                } catch (e) {
                    setError(e.message);
                }
            };

            // Start Progress Animation
            interval = setInterval(() => {
                setProgress(prev => {
                    // Cap at 90% until API returns
                    if (prev >= 90) return 90;
                    return prev + Math.random() * 2;
                });
            }, 100);

            // Call API immediately when Step 2 starts
            initDatabase();

            // Watch for 100% to finish
            if (progress >= 100 && !error) {
                clearInterval(interval);
                setStep(3);
            }

            return () => clearInterval(interval);
        }
    }, [step, progress, error]);

    const handleRegistration = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);

        if (!data.firstName || !data.lastName || !data.password || !data.email) {
            setRegError("All fields are required.");
            return;
        }
        if (data.password !== data.confirmPassword) {
            setRegError("Passwords do not match.");
            return;
        }

        setIsSealing(true);
        setRegError('');
        setLogs(prev => [...prev, "Verifying master identity...", "Sealing administrative gates..."]);

        try {
            const savedIp = localStorage.getItem('kinita_server_ip');
            const effectiveApiBase = savedIp ? `http://${savedIp}/kinita/public/api` : (apiBase ? `${apiBase}/kinita/public/api` : '/kinita/public/api');

            const useMySQL = savedIp || mode === 'master' || !window.electronAPI;

            let result;
            if (useMySQL) {
                const response = await fetch(`${effectiveApiBase}/register_owner.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                result = await response.json();
            } else if (window.electronAPI) {
                result = await window.electronAPI.registerOwner(data);
            }

            if (result.status === 'success') {
                setLogs(prev => [...prev, "System Sealed Successfully.", "Launching Control Interface..."]);
                setTimeout(() => {
                    onSetupComplete({
                        name: `${data.firstName} ${data.lastName}`,
                        role: 'Owner'
                    });
                }, 1000);
            } else {
                throw new Error(result.message);
            }
        } catch (e) {
            setIsSealing(false);
            setRegError(e.message);
            setLogs(prev => [...prev, `[ERROR] Sealing failed: ${e.message}`]);
        }
    };

    return (
        <div className="setup-container">
            <div className="wizard-card">

                {/* Step 0: Mode Selection */}
                {step === 0 && (
                    <div className="stage-mode fade-in">
                        <h1 className="mode-title">System Architecture</h1>
                        <p className="mode-subtitle">Choose how KINITA will operate on this device.</p>

                        <div className="mode-options">
                            <div className={`mode-card ${mode === 'standalone' ? 'active' : ''}`} onClick={() => handleModeSelect('standalone')}>
                                <div className="mode-icon-box">
                                    <Cpu size={32} />
                                </div>
                                <h3>Standalone Terminal</h3>
                                <p>Solo mode. Uses a local isolated database. Best for single tablets/PCs.</p>
                            </div>

                            <div className={`mode-card ${mode === 'master' ? 'active' : ''}`} onClick={() => handleModeSelect('master')}>
                                <div className="mode-icon-box">
                                    <Server size={32} />
                                </div>
                                <h3>Central Server Node</h3>
                                <p>Host mode. Stores data in MySQL (XAMPP). Allows other devices to connect.</p>
                            </div>

                            <div className={`mode-card ${mode === 'satellite' ? 'active' : ''}`} onClick={() => handleModeSelect('satellite')}>
                                <div className="mode-icon-box">
                                    <Wifi size={32} />
                                </div>
                                <h3>Satellite Terminal</h3>
                                <p>Client mode. Connects to a Central Server elsewhere in the building.</p>
                            </div>
                        </div>

                        {mode === 'satellite' && (
                            <div className="satellite-config fade-in-up">
                                <div className="input-group">
                                    <label>Central Server IP Address</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 192.168.1.10"
                                        value={remoteIp}
                                        onChange={(e) => setRemoteIp(e.target.value)}
                                    />
                                </div>
                                <button className="connect-btn" onClick={handleConnectSatellite}>
                                    <Zap size={18} />
                                    <span>Connect to Node</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Step 1: System Check - Pulsing Ring */}
                {step === 1 && (
                    <div className="stage-check fade-in">
                        <div className="scanner-core">
                            <div className="pulse-ring ring-1"></div>
                            <div className="pulse-ring ring-2"></div>
                            <div className="pulse-ring ring-3"></div>
                            <div className="center-icon">
                                <Activity size={48} className="neon-icon" />
                            </div>

                            {/* Floating Orbit Icons */}
                            <div className="orbiter orbit-1">
                                <Server size={20} />
                            </div>
                            <div className="orbiter orbit-2">
                                <HardDrive size={20} />
                            </div>
                            <div className="orbiter orbit-3">
                                <ShieldCheck size={20} />
                            </div>
                        </div>
                        <h2 className="stage-title">System Diagnostic</h2>
                        <p className="stage-status blink-text">Searching for active modules...</p>

                        <div className="setup-health-bar fade-in">
                            <div className={`health-item ${window.electronAPI ? 'online' : 'offline'}`}>
                                <span>Desktop Engine</span>
                                <div className="status-dot"></div>
                            </div>
                            <div className={`health-item ${systemHealth?.serverOnline ? 'online' : 'offline'}`}>
                                <span>XAMPP MySQL</span>
                                <div className="status-dot"></div>
                            </div>
                            <div className={`health-item ${systemHealth?.dbExists ? 'online' : 'offline'}`}>
                                <span>Core Database</span>
                                <div className="status-dot"></div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 2: Database Construction */}
                {step === 2 && (
                    <div className="stage-build fade-in">
                        <div className="db-holo-container">
                            <Database size={64} className="db-holo" strokeWidth={1} />
                            <div className="scan-line"></div>
                        </div>
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${progress}%`, backgroundColor: error ? '#ef4444' : '#a3e635' }}>
                                <div className="glow-trail"></div>
                            </div>
                        </div>
                        <h2 className="stage-title">{error ? 'Setup Failed' : 'Constructing Database'}</h2>
                        <p className="stage-status" style={{
                            color: error ? '#ef4444' : '#94a3b8',
                            fontWeight: error ? 'bold' : 'normal',
                            maxWidth: '80%',
                            textAlign: 'center',
                            wordBreak: 'break-word'
                        }}>
                            {error ? error : statusText}
                        </p>
                        {error && (
                            <button className="initialize-btn" style={{ marginTop: 20, background: '#ef4444', color: 'white' }} onClick={() => window.location.reload()}>
                                Retry
                            </button>
                        )}
                    </div>
                )}

                {/* Step 3: Validation & Launch */}
                {step === 3 && (
                    <div className="stage-ready fade-in-up">
                        <div className="success-icon-wrapper">
                            <CheckCircle size={80} className="success-icon" strokeWidth={1.5} />
                            <div className="confetti-particles"></div>
                        </div>

                        <h1 className="success-title">Environment Ready</h1>
                        <p className="success-desc">KINITA Core has been successfully verified.</p>

                        <div className="launch-panel">
                            <div className="stat-item">
                                <Boxes size={18} />
                                <span>Tables: 12</span>
                            </div>
                            <div className="divider"></div>
                            <div className="stat-item">
                                <Activity size={18} />
                                <span>Status: Active</span>
                            </div>
                            <div className="divider"></div>
                            <div className="stat-item">
                                <Database size={18} />
                                <span>Ver: 1.0</span>
                            </div>
                        </div>

                        <button className="initialize-btn" onClick={() => {
                            localStorage.removeItem('kinita_auth');
                            localStorage.removeItem('kinita_user');
                            localStorage.removeItem('kinita_db_configured');
                            window.location.reload();
                        }}>
                            <Zap size={20} fill="currentColor" />
                            <span>Initialize Store</span>
                        </button>
                    </div>
                )}

                {/* Step 4: Master Registration */}
                {step === 4 && (
                    <div className="stage-registration fade-in">
                        <div className="registration-content">
                            {/* Registration Form Panel */}
                            <div className="registration-form-panel glass-card">
                                <h2 className="form-title">Create Owner Account</h2>


                                {regError && <div className="error-banner" style={{ color: '#ef4444', marginBottom: 20, fontSize: 13 }}>{regError}</div>}

                                <form className="wizard-registration-form" onSubmit={handleRegistration}>
                                    <div className="input-grid three-col">
                                        <div className="input-group">
                                            <label>First Name</label>
                                            <input name="firstName" placeholder="Given Name" disabled={isSealing} required />
                                        </div>
                                        <div className="input-group">
                                            <label>Middle Name</label>
                                            <input name="middleName" placeholder="Optional" disabled={isSealing} />
                                        </div>
                                        <div className="input-group">
                                            <label>Last Name</label>
                                            <input name="lastName" placeholder="Surname" disabled={isSealing} required />
                                        </div>
                                    </div>
                                    <div className="input-group">
                                        <label>Email Address</label>
                                        <input name="email" type="email" placeholder="owner@kinita.com" disabled={isSealing} required />
                                    </div>
                                    <div className="input-group">
                                        <label>Password</label>
                                        <input name="password" type="password" placeholder="••••••••" disabled={isSealing} required />
                                    </div>
                                    <div className="input-group">
                                        <label>Confirm Password</label>
                                        <input name="confirmPassword" type="password" placeholder="••••••••" disabled={isSealing} required />
                                    </div>

                                    <button type="submit" className="seal-btn" disabled={isSealing}>
                                        <ShieldCheck size={20} />
                                        <span>{isSealing ? 'Sealing...' : 'Seal & Start'}</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default DatabaseSetup;
