import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Check } from 'lucide-react';
import './Login.css';

import { loadModels, getFaceDescriptor, createMatcher, detectFace, drawFaceRect } from '../utils/FaceAuth';
import { useCamera } from '../hooks/useCamera';

const Login = ({ onLogin, onRegisterClick }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);
    const [username, setUsername] = useState('');

    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Face Auth State
    const [pendingUser, setPendingUser] = useState(null);
    const [showFaceModal, setShowFaceModal] = useState(false);
    const [faceStatus, setFaceStatus] = useState('idle'); // idle, scanning, success, error
    const { videoRef, isCameraOpen, startCamera, stopCamera, error: cameraError } = useCamera();
    const canvasRef = React.useRef(null);
    const detectionLoopRef = React.useRef(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [detectionSource, setDetectionSource] = useState('NONE');
    const [features, setFeatures] = useState({ face: false, leftEye: false, rightEye: false, nose: false });

    React.useEffect(() => {
        loadModels().then(() => setIsModelLoaded(true));
        return () => {
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        };
    }, []);

    const startFaceVerification = (user) => {
        setPendingUser(user);
        setShowFaceModal(true);
        setFaceStatus('scanning');
        startCamera();
    };

    const verifyFace = React.useCallback(async () => {
        if (!videoRef.current || !pendingUser || !pendingUser.face_descriptor) return;

        try {
            const descriptor = await getFaceDescriptor(videoRef.current);
            const storedDescriptor = new Float32Array(pendingUser.face_descriptor);
            const matcher = createMatcher(storedDescriptor);
            const match = matcher.findBestMatch(descriptor);

            console.log("Face Match Result:", match.toString());

            if (match.distance < 0.5) {
                setFaceStatus('success');
                stopCamera();
                setTimeout(() => {
                    onLogin(pendingUser);
                }, 1000);
            } else {
                // Keep scanning
                // Optional: internal retry counter could go here
            }
        } catch (err) {
            // No face/error, just keep scanning
        }
    }, [videoRef, pendingUser, onLogin, stopCamera]);

    React.useEffect(() => {
        let isActive = true;
        const loop = async () => {
            if (!isActive) return;
            if (isCameraOpen && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                if (canvasRef.current && (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight)) {
                    canvasRef.current.width = videoRef.current.videoWidth;
                    canvasRef.current.height = videoRef.current.videoHeight;
                }

                try {
                    const detection = await detectFace(videoRef.current);
                    if (canvasRef.current) {
                        const ctx = canvasRef.current.getContext('2d');
                        if (detection) {
                            setDetectionSource(detection.source || 'Unknown');
                            setFeatures(detection.features || { face: true, leftEye: true, rightEye: true, nose: true });
                            // Draw box
                            drawFaceRect(canvasRef.current, detection);

                            // If we have a good detection, try to verify!
                            // We throttle verification to avoid slamming the CPU/GPU
                            // But for now, let's just try every few frames or just let the async nature handle it.
                            // Better: Only verify if detection score is high enough.
                            if (detection.score > 0.7) {
                                await verifyFace();
                            }
                        } else {
                            setDetectionSource('NONE');
                            setFeatures({ face: false, leftEye: false, rightEye: false, nose: false });
                            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                        }
                    }
                } catch (e) { }
            }
            if (isActive && faceStatus === 'scanning') {
                detectionLoopRef.current = requestAnimationFrame(loop);
            }
        };

        if (isCameraOpen && faceStatus === 'scanning') {
            loop();
        } else {
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);
        }

        return () => { isActive = false; if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current); };
    }, [isCameraOpen, faceStatus, videoRef, verifyFace]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await fetch('/kinita/public/api/login.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const text = await response.text();
            let result;
            try {
                result = JSON.parse(text);
            } catch (e) {
                console.error("Non-JSON Response", text);
                throw new Error("Server error: " + text.substring(0, 50));
            }

            if (result.status === 'success') {
                if (result.user.face_descriptor) {
                    // Trigger 2FA
                    startFaceVerification(result.user);
                } else {
                    // No face auth required/setup
                    onLogin(result.user);
                }
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error('Login Error:', err);
            setError(err.message || 'An error occurred during login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-panel glass-panel">

                {/* Header */}
                <div className="login-header">
                    <img src="/logo.svg" alt="KINITA" className="brand-logo-img" />
                    <h2 className="welcome-text">Sign In to Your Store</h2>
                    {error && <div className="error-message" style={{ color: '#ff4d4d', marginTop: '10px', fontSize: '0.9rem' }}>{error}</div>}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="login-form">
                    <div className="input-group">
                        <User size={18} className="input-icon" />
                        <input
                            type="text"
                            placeholder="Email or Username"
                            className="glass-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <Lock size={18} className="input-icon" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="toggle-password"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    <div className="form-controls">
                        <label
                            className={`remember-me ${rememberMe ? 'checked' : ''}`}
                            onClick={() => setRememberMe(!rememberMe)}
                        >
                            <div className="checkbox">
                                {rememberMe && <Check size={12} strokeWidth={4} />}
                            </div>
                            <span>Remember Me</span>
                        </label>
                        <a href="#" className="forgot-password">Forgot Password?</a>
                    </div>

                    <button type="submit" className="login-btn" disabled={loading}>
                        {loading ? 'Signing in...' : 'Login'}
                    </button>

                    <p className="role-context">
                        Secure access for Owners, Managers, Supervisors, & Cashiers
                    </p>
                </form>

                {/* Footer */}
                <div className="login-footer">
                    <p>New to KINITA? <a href="#" onClick={(e) => { e.preventDefault(); onRegisterClick(); }}>Set up Owner Account</a></p>
                </div>
            </div>

            {/* Face Auth Modal */}
            {showFaceModal && (
                <div className="modal-overlay" style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <div className="glass-panel" style={{ width: '90%', maxWidth: '400px', padding: '32px', textAlign: 'center' }}>
                        <h3 style={{ marginBottom: '16px', color: 'var(--text-primary)' }}>Biometric Verification</h3>

                        <div style={{
                            position: 'relative', width: '100%', height: '300px', background: '#000', borderRadius: '16px', overflow: 'hidden',
                            border: faceStatus === 'success' ? '4px solid #a3e635' : faceStatus === 'retry' ? '4px solid #ef4444' : '4px solid rgba(255,255,255,0.2)'
                        }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                            />
                            <canvas
                                ref={canvasRef}
                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }}
                            />



                            {/* Scanning Line Animation */}
                            {faceStatus === 'scanning' && (
                                <div className="scan-line"></div>
                            )}
                        </div>

                        <p style={{ marginTop: '16px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {faceStatus === 'scanning' && "Scanning Face..."}
                            {faceStatus === 'success' && <span style={{ color: '#a3e635' }}>Identity Verified!</span>}
                            {faceStatus === 'retry' && <span style={{ color: '#ef4444' }}>No match found. Retrying...</span>}
                            {faceStatus === 'error' && <span style={{ color: '#ef4444' }}>Camera Error</span>}
                        </p>

                        {faceStatus === 'error' && (
                            <button onClick={() => { setShowFaceModal(false); stopCamera(); }} className="action-btn" style={{ marginTop: '16px', background: '#333' }}>
                                Cancel
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Login;
