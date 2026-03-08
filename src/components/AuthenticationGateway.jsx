import React, { useState, useEffect } from 'react';
import { Shield, BadgeCheck, Tag, Lock, Server, Key, Eye, EyeOff, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getApiBase } from '../utils/api';
import { loadModels, getFaceDescriptor, getAverageFaceDescriptor, detectFace, drawFaceRect, checkBrightness, checkForDuplicateFace, createMatcher } from '../utils/FaceAuth';
import { useCamera } from '../hooks/useCamera';
import './AuthenticationGateway.css';

const AuthenticationGateway = ({ initialMode = 'login', onLogin, onSetupComplete, systemHealth, apiBase }) => {
    // apiBase from App.jsx is the SERVER ROOT (e.g. http://localhost). 
    // getApiBase() returns the FULL API PATH.
    const API_URL = apiBase
        ? `${apiBase}/kinita/public/api`
        : (getApiBase() || '/kinita/public/api');
    const [mode, setMode] = useState(initialMode); // 'setup' | 'login'
    const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [rolePreview, setRolePreview] = useState(null);
    const [showPassword, setShowPassword] = useState(false);

    // Setup Form State
    const [setupData, setSetupData] = useState({
        firstName: '',
        middleName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
        faceDescriptor: null
    });

    // Face Auth State
    const { videoRef, isCameraOpen, startCamera, stopCamera, error: cameraError } = useCamera();
    const [isModelLoaded, setIsModelLoaded] = useState(false);

    // Low Light Detection
    const [isLowLight, setIsLowLight] = useState(false);

    // 2FA Verification State
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [faceStatus, setFaceStatus] = useState('idle'); // idle, scanning, success, error, retry
    const [pendingUser, setPendingUser] = useState(null);

    // Login Mode State
    const [loginMethod, setLoginMethod] = useState('password'); // 'password' | 'face'
    const [enrolledUsers, setEnrolledUsers] = useState([]);
    const enrolledUsersRef = React.useRef(enrolledUsers);
    const identifyUserRef = React.useRef(null);
    const modeRef = React.useRef(mode);
    const loginMethodRef = React.useRef(loginMethod);

    useEffect(() => {
        enrolledUsersRef.current = enrolledUsers;
        modeRef.current = mode;
        loginMethodRef.current = loginMethod;
    }, [enrolledUsers, mode, loginMethod]);

    const [faceFeedback, setFaceFeedback] = useState('Position Face in Frame');

    // Visuals & Logic State
    const canvasRef = React.useRef(null);
    const detectionLoopRef = React.useRef(null);
    const [stability, setStability] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [detectionSource, setDetectionSource] = useState('NONE');
    const [features, setFeatures] = useState({ face: false, leftEye: false, rightEye: false, nose: false });
    const STABILITY_THRESHOLD = 20;
    const lastVerifyTime = React.useRef(0);
    const lastBrightnessCheck = React.useRef(0);
    const livenessVerifiedRef = React.useRef(false);
    const blinkStateRef = React.useRef('idle');




    React.useEffect(() => {
        loadModels().then(() => {
            setIsModelLoaded(true);

        });

        const fetchEnrolled = async () => {
            const savedIp = localStorage.getItem('kinita_server_ip');
            const isSync = localStorage.getItem('kinita_sync_mode') === 'mysql';
            let users = [];

            try {
                if (savedIp || isSync || !window.electronAPI) {
                    const res = await fetch(`${API_URL}/get_enrolled_users.php?t=${Date.now()}`);
                    users = await res.json();
                } else if (window.electronAPI) {
                    users = await window.electronAPI.getEnrolledUsers();
                }
                const validUsers = Array.isArray(users) ? users : [];
                setEnrolledUsers(validUsers);
            } catch (e) {
                console.warn("Fetch error:", e);
            }
        };
        fetchEnrolled();
    }, [API_URL]);

    useEffect(() => {
        // Reset liveness on mode change
        livenessVerifiedRef.current = false;

        let isActive = true;
        const loop = async () => {
            if (!isActive) return;

            if (isCameraOpen) {
                try {
                    if (!videoRef.current) {
                        if (isActive) detectionLoopRef.current = requestAnimationFrame(loop);
                        return;
                    }

                    // Force play if paused (Fix for stuck loop)
                    if (videoRef.current.paused) {
                        try { await videoRef.current.play(); } catch (e) { }
                    }

                    if (videoRef.current.readyState < 2) {
                        if (isActive) detectionLoopRef.current = requestAnimationFrame(loop);
                        return;
                    }

                    if (canvasRef.current && (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight)) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                    }

                    const now = Date.now();
                    // Brightness Check
                    if (now - lastBrightnessCheck.current > 1000) {
                        const b = checkBrightness(videoRef.current);
                        const threshold = 40;
                        setIsLowLight(b < threshold);
                        lastBrightnessCheck.current = now;
                    }

                    const detection = await detectFace(videoRef.current);

                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (detection && detection.box) {
                            setDetectionSource(detection.source || 'Unknown');
                            setFeatures(detection.features || { face: true, leftEye: true, rightEye: true, nose: true });
                            drawFaceRect(canvasRef.current, detection);

                            const currentMode = modeRef.current;
                            const currentMethod = loginMethodRef.current;
                            // --- CONSOLE DEBUGGING & VISIBLE OVERLAY ---
                            if (currentMode === 'login' && currentMethod === 'face') {
                                // Liveness Check (Blink Detection) using State Machine
                                // Sequence required: Open -> Closed -> Open
                                const leftVal = detection.blendshapes?.leftBlink || 0;
                                const rightVal = detection.blendshapes?.rightBlink || 0;

                                const eyesOpen = leftVal < 0.3 && rightVal < 0.3;
                                const eyesClosed = leftVal > 0.6 && rightVal > 0.6; // Verify clear closure

                                // DEBUG LIVENESS
                                if (window.debugLoopCounter % 60 === 0) {
                                    console.log("Liveness Debug:", {
                                        state: blinkStateRef.current,
                                        open: eyesOpen,
                                        closed: eyesClosed,
                                        vals: { l: leftVal.toFixed(2), r: rightVal.toFixed(2) }
                                    });
                                }

                                if (!livenessVerifiedRef.current) {
                                    if (blinkStateRef.current === 'idle') {
                                        setFaceFeedback("Please Blink to Login");
                                        if (eyesOpen) blinkStateRef.current = 'open';
                                    }
                                    else if (blinkStateRef.current === 'open') {
                                        setFaceFeedback("Please Blink to Login");
                                        if (eyesClosed) blinkStateRef.current = 'closed';
                                    }
                                    else if (blinkStateRef.current === 'closed') {
                                        setFaceFeedback("Open eyes...");
                                        // If eyes open again, verify!
                                        if (eyesOpen) {
                                            blinkStateRef.current = 'verified';
                                            livenessVerifiedRef.current = true;
                                            setFaceFeedback("Verifying Identity...");
                                        }
                                    }

                                    // Fallback: If FaceAPI is used (no blendshapes), allow login but skip liveness
                                    if (detection.source === 'faceapi') {
                                        setFaceFeedback("Hold Still (Standard Security)");
                                        livenessVerifiedRef.current = true;
                                    }
                                }

                                if (livenessVerifiedRef.current) {
                                    if (detection.score > 0.3) {
                                        const now = Date.now();
                                        const timeDiff = now - lastVerifyTime.current;
                                        if (timeDiff > 1000) {
                                            lastVerifyTime.current = now;
                                            try {
                                                if (identifyUserRef.current) await identifyUserRef.current();
                                            } catch (err) { console.error(err); }
                                        }
                                    }
                                }
                            } else if (currentMode === 'setup') {
                                setFaceFeedback("Face detected! Hold still...");
                                setStability(prev => Math.min(prev + (100 / STABILITY_THRESHOLD), 100));
                            }
                        } else {
                            // Face Lost
                            setDetectionSource(detection?.source || 'NONE');
                            setFeatures(detection?.features || { face: false, leftEye: false, rightEye: false, nose: false });

                            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                            if (currentMode === 'setup') {
                                setFaceFeedback("Looking for face...");
                                setStability(0);
                            } else if (currentMode === 'login') {
                                livenessVerifiedRef.current = false;
                                blinkStateRef.current = 'idle'; // Reset state machine on face loss
                                setFaceFeedback("Position Face in Frame");
                            }
                        }
                    }
                } catch (e) {
                    console.error("Loop Error:", e);
                }
            }

            if (isActive) detectionLoopRef.current = requestAnimationFrame(loop);
        };

        if (isCameraOpen) {
            loop();
        } else {
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        }

        return () => {
            isActive = false;
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        };
    }, [isCameraOpen, mode, loginMethod, videoRef]);

    const identifyUser = React.useCallback(async () => {
        const users = enrolledUsersRef.current;
        if (!videoRef.current || users.length === 0 || !isCameraOpen) {
            // console.log("Skip identify: ", { vid: !!videoRef.current, users: users.length, cam: isCameraOpen });
            return;
        }

        try {
            // setDebugInfo removed
            const descriptor = await getFaceDescriptor(videoRef.current);

            // 1. Prepare Labeled Descriptors
            const labeledDescriptors = users
                .filter(u => u.face_descriptor)
                .map(user => {
                    try {
                        const values = Object.values(user.face_descriptor);
                        const floatArray = new Float32Array(values);
                        return new window.faceapi.LabeledFaceDescriptors(user.name, [floatArray]);
                    } catch (e) {
                        return null;
                    }
                })
                .filter(ld => ld !== null);

            if (labeledDescriptors.length === 0) {
                // setDebugInfo removed
                console.warn("No valid enrolled faces found.");
                return;
            }

            // 2. Create Matcher (0.6 is good default distance)
            const matcher = new window.faceapi.FaceMatcher(labeledDescriptors, 0.6);

            // 3. Match
            const match = matcher.findBestMatch(descriptor);
            // setDebugInfo removed
            console.log("Face Match Result:", match.toString());

            // 4. Verify
            // match.label is the user.name (or 'unknown')
            if (match.label !== 'unknown') {
                const user = users.find(u => u.name === match.label);
                if (user) {
                    console.log("Login Success:", user.name);
                    stopCamera();
                    setStatus('success');
                    setTimeout(() => {
                        onLogin({
                            employee_id: user.id,
                            name: user.name,
                            role: user.role
                        });
                    }, 800);
                }
            } else {
                console.log("Face not recognized:", match.label);
            }
        } catch (err) {
            console.warn("Identification error or skip:", err);
        }
    }, [isCameraOpen, stopCamera, onLogin, videoRef]);

    useEffect(() => {
        identifyUserRef.current = identifyUser;
    }, [identifyUser]);

    useEffect(() => {
        if (loginMethod === 'face') {
            setErrorMessage('');
            startCamera().catch(err => {
                console.error(err);
                setErrorMessage("Camera access denied.");
            });
        } else {
            stopCamera();
        }
    }, [loginMethod]);

    const captureFace = React.useCallback(async () => {
        if (!videoRef.current || isCapturing) return;
        setIsCapturing(true);
        try {
            // Stop loop to prevent double capture
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);

            setFaceFeedback("Scanning... Hold Still");

            const descriptor = await getAverageFaceDescriptor(videoRef.current, 20, (progress) => {
                setScanProgress(progress);
            });

            // Check for duplicates
            const duplicateUser = checkForDuplicateFace(descriptor, enrolledUsers);
            if (duplicateUser) {
                setErrorMessage(`Cannot Enroll: Face already matches ${duplicateUser.name} (${duplicateUser.role})`);
                setFaceFeedback(`Face already matches ${duplicateUser.name}`);
                setStability(0);
                setIsCapturing(false);
                setScanProgress(0);
                stopCamera();
                return;
            }

            setSetupData(prev => ({ ...prev, faceDescriptor: Array.from(descriptor) }));
            stopCamera();
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
        } catch (err) {
            console.warn("Auto-capture failed", err);
            setErrorMessage(err.message || "Capture failed");
            setFaceFeedback("Capture failed. Try again.");
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
        }
    }, [videoRef, stopCamera, enrolledUsers, isCapturing]);

    useEffect(() => {
        // Auto-capture trigger
        if (stability >= 100) {
            captureFace();
        }
    }, [stability, captureFace]);

    useEffect(() => {
        const checkSeal = async () => {
            try {
                const savedIp = localStorage.getItem('kinita_server_ip');
                const isSync = localStorage.getItem('kinita_sync_mode') === 'mysql';
                let data;

                if (savedIp || isSync || !window.electronAPI) {
                    const res = await fetch(`${API_URL}/check_seal.php?t=${Date.now()}`);
                    data = await res.json();
                } else if (window.electronAPI) {
                    data = await window.electronAPI.checkSeal();
                }

                if (data && data.status === 'success') {
                    setMode(data.is_sealed ? 'login' : 'setup');
                }
            } catch (err) {
                console.error("Check seal error:", err);
                setErrorMessage("Database connectivity issue.");
            }
        };
        checkSeal();
    }, [API_URL]);

    useEffect(() => {
        if (mode === 'login') {
            const lowerUser = username.toLowerCase();
            if (lowerUser.includes('owner')) {
                setRolePreview({ type: 'owner', icon: Shield, label: 'Owner Access' });
            } else if (lowerUser.includes('admin') || lowerUser.includes('manage')) {
                setRolePreview({ type: 'manager', icon: BadgeCheck, label: 'Manager' });
            } else if (lowerUser.includes('cash')) {
                setRolePreview({ type: 'cashier', icon: Tag, label: 'Cashier' });
            } else {
                setRolePreview(null);
            }
        }
    }, [username, mode]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setStatus('loading');
        setErrorMessage('');

        try {
            const savedIp = localStorage.getItem('kinita_server_ip');
            const isSync = localStorage.getItem('kinita_sync_mode') === 'mysql';
            let data;

            if (savedIp || isSync || !window.electronAPI) {
                const res = await fetch(`${API_URL}/login.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                data = await res.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.login({ username, password });
            }

            if (data.status === 'success') {
                setStatus('success');
                setTimeout(() => {
                    onLogin({
                        employee_id: data.user.employee_id,
                        name: data.user.name,
                        role: data.user.role
                    });
                }, 800);
            } else {
                throw new Error(data.message || 'Login failed');
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
            setTimeout(() => setStatus('idle'), 500);
        }
    };

    const handleReset = async () => {
        if (!window.confirm("WARNING: This will WIPE ALL DATA and reset the system to factory defaults. Are you sure?")) {
            return;
        }

        setStatus('loading');
        try {
            const savedIp = localStorage.getItem('kinita_server_ip');
            const isSync = localStorage.getItem('kinita_sync_mode') === 'mysql';
            let data;

            if (savedIp || isSync || !window.electronAPI) {
                const res = await fetch(`${API_URL}/reset_db.php`);
                data = await res.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.resetDb();
            }

            if (data.status === 'success') {
                alert("System Reset Complete. Reloading...");
                localStorage.clear();
                window.location.reload();
            } else {
                throw new Error(data.message || "Reset failed");
            }
        } catch (error) {
            setErrorMessage("Reset Error: " + error.message);
            setStatus('idle');
        }
    };

    const handleSetup = async (e) => {
        e.preventDefault();
        if (!setupData.firstName || !setupData.lastName || !setupData.email || !setupData.username || !setupData.password || !setupData.confirmPassword) {
            setErrorMessage("Fields cannot be empty.");
            return;
        }

        if (setupData.password !== setupData.confirmPassword) {
            setErrorMessage("Passwords do not match.");
            return;
        }

        setStatus('loading');
        setErrorMessage('');

        try {
            const savedIp = localStorage.getItem('kinita_server_ip');
            const isSync = localStorage.getItem('kinita_sync_mode') === 'mysql';
            let data;

            if (savedIp || isSync || !window.electronAPI) {
                const res = await fetch(`${API_URL}/register_owner.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(setupData)
                });
                data = await res.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.registerOwner(setupData);
            }

            if (data.status === 'success') {
                setStatus('success');
                setTimeout(() => {
                    onSetupComplete({
                        name: `${setupData.firstName} ${setupData.lastName}`,
                        role: 'Owner',
                        avatar: 'Felix'
                    });
                }, 800);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
            setTimeout(() => setStatus('idle'), 500);
        }
    };



    const isShake = status === 'error';
    const isDissolving = status === 'success';

    return (
        <div className={`gateway-container ${isDissolving ? 'dissolve' : ''}`}>
            <div className="gateway-bg-trails"></div>

            <div className={`gateway-card ${isShake ? 'shake' : ''}`}>

                {mode === 'login' && (
                    <div className="gateway-header">
                        <div className="system-status">
                            <div className="status-beacon pulsing-green"></div>
                            <span>SYSTEM SECURE</span>
                        </div>
                        <h1 className="gateway-title">KINITA | Terminal Access</h1>
                    </div>
                )}

                {errorMessage && <div className="error-banner">{errorMessage}</div>}

                {mode === 'login' && (
                    <>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '0 5px' }}>
                            <button
                                type="button"
                                onClick={() => setLoginMethod('password')}
                                className={`seal-btn ${loginMethod === 'password' ? '' : 'secondary'}`}
                                style={{
                                    flex: 1,
                                    background: loginMethod === 'password' ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)' : 'rgba(0,0,0,0.05)',
                                    color: loginMethod === 'password' ? '#020617' : '#64748b',
                                    height: '40px',
                                    border: loginMethod === 'password' ? 'none' : '1px solid rgba(0,0,0,0.1)'
                                }}
                            >
                                <Key size={16} />
                                <span>Password</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setLoginMethod('face')}
                                className={`seal-btn ${loginMethod === 'face' ? '' : 'secondary'}`}
                                style={{
                                    flex: 1,
                                    background: loginMethod === 'face' ? 'linear-gradient(135deg, #a3e635 0%, #84cc16 100%)' : 'rgba(0,0,0,0.05)',
                                    color: loginMethod === 'face' ? '#020617' : '#64748b',
                                    height: '40px',
                                    border: loginMethod === 'face' ? 'none' : '1px solid rgba(0,0,0,0.1)'
                                }}
                            >
                                <Eye size={16} />
                                <span>Face ID</span>
                            </button>
                        </div>

                        {loginMethod === 'password' ? (
                            <form onSubmit={handleLogin} className="gateway-form login-mode">
                                <div className="input-field-wrapper">
                                    <label>Identity</label>
                                    <div className="input-box">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            placeholder="Username"
                                            autoFocus
                                            disabled={status === 'loading'}
                                        />
                                        {rolePreview && (
                                            <div className={`role-indicator ${rolePreview.type} fade-in`}>
                                                <rolePreview.icon size={16} />
                                                <span>{rolePreview.label}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="input-field-wrapper">
                                    <label>Passcode</label>
                                    <div className="input-box">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            disabled={status === 'loading'}
                                        />
                                        <button type="button" className="reveal-btn" onClick={() => setShowPassword(!showPassword)}>
                                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <button type="submit" className="authorize-btn">
                                    <span>{status === 'loading' ? 'Verifying...' : 'Authorize Access'}</span>
                                    <div className="btn-glow"></div>
                                </button>


                            </form>
                        ) : (
                            <div className="gateway-form login-mode" style={{ textAlign: 'center' }}>
                                {!isCameraOpen && <p style={{ color: 'rgba(255,255,255,0.5)', marginBottom: '10px' }}>Initializing Camera...</p>}
                                <div className="camera-container" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', width: '100%', maxWidth: '320px', aspectRatio: '4/3', background: '#000', margin: '0 auto 20px' }}>
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        muted
                                        playsInline
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: isLowLight ? 0.5 : 1 }}
                                    />
                                    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: `scaleX(-1)`, pointerEvents: 'none' }} />




                                    {/* Status Bar */}
                                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '240px', pointerEvents: 'none', zIndex: 20 }}>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '180px', height: '220px', border: '2px dashed #a3e635', borderRadius: '110px', boxShadow: '0 0 0 999px rgba(0,0,0,0.5)', opacity: stability > 0 ? 1 : 0.5 }} className={stability > 0 ? "face-guide-pulse" : ""}></div>
                                        <div className="scan-line" style={{ top: '10%', width: '140px', left: '30px' }}></div>
                                        <svg width="200" height="240" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                                            <rect x="0" y="0" width="200" height="240" fill="none" rx="100" ry="120" stroke="#a3e635" strokeWidth="4" strokeDasharray="700" strokeDashoffset={700 - (700 * stability / 100)} strokeLinecap="round" />
                                        </svg>
                                    </div>

                                    {stability > 0 && (
                                        <div style={{ position: 'absolute', top: 16, left: 0, width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 15 }}>
                                            <div style={{ background: 'rgba(163, 230, 53, 0.2)', color: '#a3e635', padding: '6px 16px', borderRadius: '20px', fontSize: '0.9rem', backdropFilter: 'blur(4px)', border: '1px solid #a3e635' }}>
                                                Verifying Face... {Math.round(stability)}%
                                            </div>
                                        </div>
                                    )}

                                    {isLowLight && (
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.8)', color: '#ff4d4d', padding: '16px 24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', zIndex: 20 }}>
                                            <span style={{ fontSize: '2rem' }}>☀️</span>
                                            <span style={{ fontWeight: 'bold' }}>Too Dark</span>
                                        </div>
                                    )}

                                </div>
                                <p className="scan-instruction">{faceFeedback}</p>

                            </div>
                        )}
                    </>
                )}

                {mode === 'setup' && (
                    <form onSubmit={handleSetup} className="gateway-form setup-mode">
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem', textAlign: 'center' }}>Create Owner Account</h1>

                        <div className="input-grid three-col">
                            <div className="input-field-wrapper">
                                <label>First Name</label>
                                <div className="input-box"><input type="text" placeholder="Given Name" value={setupData.firstName} onChange={(e) => setSetupData({ ...setupData, firstName: e.target.value })} required /></div>
                            </div>
                            <div className="input-field-wrapper">
                                <label>Middle Name</label>
                                <div className="input-box"><input type="text" placeholder="Optional" value={setupData.middleName} onChange={(e) => setSetupData({ ...setupData, middleName: e.target.value })} /></div>
                            </div>
                            <div className="input-field-wrapper">
                                <label>Last Name</label>
                                <div className="input-box"><input type="text" placeholder="Surname" value={setupData.lastName} onChange={(e) => setSetupData({ ...setupData, lastName: e.target.value })} required /></div>
                            </div>
                        </div>

                        <div className="input-field-wrapper" style={{ marginTop: '10px' }}>
                            <label>Email Address</label>
                            <div className="input-box"><input type="email" placeholder="owner@kinita.com" value={setupData.email} onChange={(e) => setSetupData({ ...setupData, email: e.target.value })} required /></div>
                        </div>

                        <div className="input-field-wrapper" style={{ marginBottom: '20px', marginTop: '10px' }}>
                            <label>Biometric Enrollment</label>
                            <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {!setupData.faceDescriptor ? (
                                    <>
                                        {!isCameraOpen ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', width: '100%' }}>
                                                <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Secure your account with Face ID.</p>
                                                <button type="button" onClick={startCamera} className="seal-btn" style={{ background: 'rgba(255,255,255,0.1)', marginTop: 0, width: 'auto', padding: '8px 24px' }} disabled={!isModelLoaded}>
                                                    {isModelLoaded ? 'Start Face Enrollment' : 'Loading...'}
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="camera-container" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', width: '100%', maxWidth: '320px', aspectRatio: '4/3', background: '#000' }}>
                                                <video
                                                    ref={videoRef}
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    onLoadedMetadata={() => {
                                                        if (canvasRef.current && videoRef.current) {
                                                            canvasRef.current.width = videoRef.current.videoWidth;
                                                            canvasRef.current.height = videoRef.current.videoHeight;
                                                        }
                                                    }}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: isLowLight ? 0.5 : 1 }}
                                                />
                                                <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: `scaleX(-1)`, pointerEvents: 'none' }} />



                                                {/* Visual Guide Frame & Progress Ring */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '50%', left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: '220px', height: '260px',
                                                    pointerEvents: 'none',
                                                    zIndex: 20
                                                }}>
                                                    {/* Dashed Border (Inner) */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%', left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        width: '200px', height: '240px',
                                                        border: '2px dashed #a3e635',
                                                        borderRadius: '120px',
                                                        boxShadow: '0 0 0 999px rgba(0,0,0,0.5)',
                                                        opacity: stability > 0 ? 1 : 0.5,
                                                        transition: 'opacity 0.3s'
                                                    }} className={stability > 0 ? "face-guide-pulse" : ""}></div>

                                                    {/* Scanner Line */}
                                                    <div className="scan-line" style={{ top: '10%', width: '160px', left: '30px' }}></div>

                                                    {/* Progress Ring (SVG) */}
                                                    <svg width="220" height="260" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                                                        <rect x="0" y="0" width="220" height="260" fill="none" rx="110" ry="130" />
                                                        <rect
                                                            x="0" y="0" width="220" height="260"
                                                            fill="none"
                                                            rx="110" ry="130"
                                                            stroke="#a3e635"
                                                            strokeWidth="5"
                                                            strokeDasharray="760" // Approx perimeter
                                                            strokeDashoffset={760 - (760 * (isCapturing ? scanProgress : stability) / 100)}
                                                            strokeLinecap="round"
                                                            style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                                                        />
                                                    </svg>
                                                </div>

                                                {/* Top Status Bar (Feedback) */}
                                                <div style={{ position: 'absolute', top: 20, left: 0, width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 15 }}>
                                                    <div style={{
                                                        background: (stability > 0 || isCapturing) ? 'rgba(163, 230, 53, 0.2)' : 'rgba(0,0,0,0.6)',
                                                        color: (stability > 0 || isCapturing) ? '#a3e635' : '#fff',
                                                        padding: '6px 16px',
                                                        borderRadius: '20px',
                                                        fontSize: '0.9rem',
                                                        backdropFilter: 'blur(4px)',
                                                        border: `1px solid ${(stability > 0 || isCapturing) ? '#a3e635' : 'rgba(255,255,255,0.1)'}`,
                                                        transition: 'all 0.3s ease',
                                                        maxWidth: '80%',
                                                        textAlign: 'center'
                                                    }}>
                                                        {isLowLight ? "Lighting Issue" : (isCapturing ? `Scanning: ${Math.round(scanProgress)}%` : faceFeedback)}
                                                    </div>
                                                </div>

                                                {/* Low Light Warning - Centered & Prominent */}
                                                {isLowLight && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '50%', left: '50%',
                                                        transform: 'translate(-50%, -50%)',
                                                        background: 'rgba(0,0,0,0.8)',
                                                        color: '#ff4d4d',
                                                        padding: '16px 24px',
                                                        borderRadius: '12px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        backdropFilter: 'blur(8px)',
                                                        border: '1px solid rgba(255, 77, 77, 0.3)',
                                                        zIndex: 20
                                                    }}>
                                                        <span style={{ fontSize: '2rem' }}>☀️</span>
                                                        <span style={{ fontWeight: 'bold' }}>Too Dark</span>
                                                        <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Please face a light source</span>
                                                    </div>
                                                )}

                                                {/* Overlay Controls */}
                                                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '16px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>

                                                    {/* Capture Button (Auto-Capture Only) */}
                                                    <button
                                                        type="button"
                                                        className="seal-btn"
                                                        disabled={true}
                                                        style={{
                                                            width: 'auto',
                                                            background: (stability >= 100 || isCapturing) ? '#a3e635' : 'rgba(255,255,255,0.1)',
                                                            color: (stability >= 100 || isCapturing) ? '#020617' : 'rgba(255,255,255,0.3)',
                                                            padding: '8px 24px',
                                                            zIndex: 10,
                                                            pointerEvents: 'none',
                                                            marginTop: 0
                                                        }}
                                                    >
                                                        {isCapturing ? 'Scanning...' : (stability >= 100 ? 'Capturing...' : 'Hold Still...')}
                                                    </button>

                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div style={{ color: '#a3e635', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px' }}>
                                        <div style={{ background: 'rgba(163, 230, 53, 0.2)', borderRadius: '50%', padding: '12px', display: 'flex' }}><Check size={32} color="#a3e635" strokeWidth={3} /></div>
                                        <span style={{ fontWeight: '600', fontSize: '1.1rem' }}>Face Enrolled Successfully</span>
                                        <button type="button" onClick={() => setSetupData(prev => ({ ...prev, faceDescriptor: null }))} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Remove & Retake</button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="input-field-wrapper">
                            <label>Username</label>
                            <div className="input-box"><input type="text" placeholder="Username" value={setupData.username} onChange={(e) => setSetupData({ ...setupData, username: e.target.value })} required /></div>
                        </div>

                        <div className="input-grid">
                            <div className="input-field-wrapper">
                                <label>Password</label>
                                <div className="input-box"><input type="password" placeholder="••••••••" value={setupData.password} onChange={(e) => setSetupData({ ...setupData, password: e.target.value })} required /></div>
                            </div>
                            <div className="input-field-wrapper">
                                <label>Confirm Password</label>
                                <div className="input-box"><input type="password" placeholder="••••••••" value={setupData.confirmPassword} onChange={(e) => setSetupData({ ...setupData, confirmPassword: e.target.value })} required /></div>
                            </div>
                        </div>

                        <button type="submit" className="seal-btn"><Lock size={18} /><span>{status === 'loading' ? 'Sealing...' : 'Seal System & Launch'}</span></button>

                        <div className="gateway-options">
                            <button type="button" className="text-btn red" onClick={handleReset}>System Error? Reset Database</button>
                        </div>
                    </form>
                )}
            </div>

            {
                showFaceModal && (
                    <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '32px', textAlign: 'center', background: 'rgba(10,10,10,0.95)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <h3 style={{ marginBottom: '16px', color: '#fff' }}>Biometric Verification</h3>
                            <div style={{ position: 'relative', width: '100%', height: '300px', background: '#000', borderRadius: '16px', overflow: 'hidden', border: faceStatus === 'success' ? '4px solid #a3e635' : faceStatus === 'retry' ? '4px solid #ef4444' : '4px solid rgba(255,255,255,0.2)' }}>
                                <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
                                {faceStatus === 'scanning' && <div className="scan-line"></div>}
                            </div>
                            <p style={{ marginTop: '16px', fontWeight: 600, color: '#aaa' }}>
                                {faceStatus === 'scanning' && "Scanning Face..."}
                                {faceStatus === 'success' && <span style={{ color: '#a3e635' }}>Identity Verified!</span>}
                                {faceStatus === 'retry' && <span style={{ color: '#ef4444' }}>No match found. Retrying...</span>}
                                {faceStatus === 'error' && <span style={{ color: '#ef4444' }}>Camera Error</span>}
                            </p>
                            {faceStatus === 'error' && <button onClick={() => { setShowFaceModal(false); stopCamera(); }} className="seal-btn" style={{ marginTop: '16px', background: '#333' }}>Cancel</button>}
                        </div>
                    </div>
                )
            }

            <div className="gateway-footer">
                <div className="health-status-bar">
                    <div className={`health-node ${systemHealth?.serverOnline ? 'online' : 'offline'}`}><div className="dot"></div><span>MySQL</span></div>
                    <div className={`health-node ${systemHealth?.dbExists ? 'online' : 'offline'}`}><div className="dot"></div><span>Database</span></div>
                </div>
                <p>{window.electronAPI ? 'SECURE DESKTOP PROTOCOL • LOCAL SQLITE INSTANCE' : 'SECURE CONNECTION • ENCRYPTED VIA XAMPP/MYSQL'}</p>
            </div>
        </div >
    );
};

export default AuthenticationGateway;
