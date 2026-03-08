import React, { useState } from 'react';
import { User, Lock, MapPin, Store, Mail, Info, Eye, EyeOff, Check } from 'lucide-react';
import './Register.css';

import { loadModels, getFaceDescriptor, getAverageFaceDescriptor, detectFace, drawFaceRect, checkBrightness } from '../utils/FaceAuth';
import { useCamera } from '../hooks/useCamera';

const Register = ({ onRegister, onBack }) => {
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        storeName: '',
        location: '',
        ownerName: '',
        email: '',
        password: '',
        confirmPassword: '',
        faceDescriptor: null
    });

    const { videoRef, isCameraOpen, startCamera, stopCamera, error: cameraError } = useCamera();
    const canvasRef = React.useRef(null);
    const [faceFeedback, setFaceFeedback] = useState("Position your face in the frame");
    const detectionLoopRef = React.useRef(null);
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const [stability, setStability] = useState(0);
    const [scanProgress, setScanProgress] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const STABILITY_THRESHOLD = 20; // Faster auto-capture for consistent experience
    const [isLowLight, setIsLowLight] = useState(false);
    const lastBrightnessCheck = React.useRef(0);

    React.useEffect(() => {
        let isActive = true;
        const loop = async () => {
            if (!isActive) return;
            if (isCameraOpen && videoRef.current && !videoRef.current.paused && !videoRef.current.ended) {
                // Ensure video has dimensions
                if (videoRef.current.readyState < 2) return; // Wait for video data

                if (canvasRef.current) {
                    // Match canvas to video resolution
                    if (canvasRef.current.width !== videoRef.current.videoWidth || canvasRef.current.height !== videoRef.current.videoHeight) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                    }

                    try {
                        // Brightness Check (every 1s)
                        const now = Date.now();
                        if (now - lastBrightnessCheck.current > 1000) {
                            const b = checkBrightness(videoRef.current);
                            setIsLowLight(b < 40);
                            lastBrightnessCheck.current = now;
                        }

                        const detection = await detectFace(videoRef.current);

                        if (detection) {
                            drawFaceRect(canvasRef.current, detection);
                            setFaceFeedback("Face detected! Hold still...");
                            setStability(prev => Math.min(prev + (100 / STABILITY_THRESHOLD), 100));
                        } else {
                            const ctx = canvasRef.current.getContext('2d');
                            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                            setFaceFeedback("Looking for face...");
                            setStability(0);
                        }
                    } catch (e) {
                        console.error("Detection Loop Error:", e);
                        setFaceFeedback("Detection Error");
                    }
                }
            }
            if (isActive) detectionLoopRef.current = requestAnimationFrame(loop);
        };
        if (isCameraOpen) loop();
        else if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);

        return () => { isActive = false; if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current); };
    }, [isCameraOpen, videoRef]);

    React.useEffect(() => {
        loadModels().then(() => setIsModelLoaded(true));
    }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const captureFace = React.useCallback(async () => {
        if (!videoRef.current || isCapturing) return;
        setIsCapturing(true);
        setFaceFeedback("Scanning... Hold Still");

        try {
            if (detectionLoopRef.current) cancelAnimationFrame(detectionLoopRef.current);

            // 5 Samples for better accuracy
            const descriptor = await getAverageFaceDescriptor(videoRef.current, 20, (progress) => {
                setScanProgress(progress);
                setFaceFeedback(`Scanning... ${Math.round(progress)}%`);
            });

            setFormData(prev => ({ ...prev, faceDescriptor: Array.from(descriptor) }));
            stopCamera();
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
        } catch (err) {
            console.warn("Auto-capture failed", err);
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
            setFaceFeedback("Scan Failed. Try Again.");
        }
    }, [videoRef, stopCamera, isCapturing]);

    React.useEffect(() => {
        if (stability >= 100) captureFace();
    }, [stability, captureFace]);

    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);


    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch('/kinita/public/api/register_owner.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
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
                onRegister({
                    name: formData.ownerName,
                    role: 'Owner',
                    store: formData.storeName
                });
                alert('Owner account created successfully! Please proceed to dashboard.');
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error('Registration Error:', err);
            setError(err.message || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="register-panel glass-panel">

                {/* Header */}
                <div className="auth-header">
                    <img src="/logo.svg" alt="KINITA" className="brand-logo-img" />
                    <h2 className="header-title">Owner Account Setup & Store Registration</h2>
                    {error && <div className="error-message" style={{ color: '#ff4d4d', marginTop: '10px', fontSize: '0.9rem' }}>{error}</div>}
                </div>

                {/* Warning Banner */}
                <div className="info-banner">
                    <Info size={16} className="info-icon" />
                    <p>
                        <strong>Note:</strong> Only Store Owners should register here. Cashiers, Managers, and Supervisors must be added internally via the Dashboard.
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="register-form">

                    {/* Store Details Section */}
                    <div className="form-section">
                        <h3 className="section-label">Store Details</h3>
                        <div className="input-grid">
                            <div className="input-group">
                                <Store size={18} className="input-icon" />
                                <input
                                    name="storeName"
                                    value={formData.storeName}
                                    onChange={handleChange}
                                    type="text"
                                    placeholder="Convenience Store Name"
                                    className="glass-input"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <MapPin size={18} className="input-icon" />
                                <input
                                    name="location"
                                    value={formData.location}
                                    onChange={handleChange}
                                    type="text"
                                    placeholder="Store Location / Branch ID"
                                    className="glass-input"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Owner Credentials Section */}
                    <div className="form-section">
                        <h3 className="section-label">Owner Credentials</h3>
                        <div className="input-grid">
                            <div className="input-group">
                                <User size={18} className="input-icon" />
                                <input
                                    name="ownerName"
                                    value={formData.ownerName}
                                    onChange={handleChange}
                                    type="text"
                                    placeholder="Owner Full Name"
                                    className="glass-input"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <Mail size={18} className="input-icon" />
                                <input
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    type="email"
                                    placeholder="Owner Email Address"
                                    className="glass-input"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <Lock size={18} className="input-icon" />
                                <input
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Password"
                                    className="glass-input"
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
                            <div className="input-group">
                                <Lock size={18} className="input-icon" />
                                <input
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    type="password"
                                    placeholder="Confirm Password"
                                    className="glass-input"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Face Enrollment Section */}
                    <div className="form-section">
                        <h3 className="section-label">Biometric Enrollment</h3>
                        <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.4)' }}>
                            {!formData.faceDescriptor ? (
                                <>
                                    {!isCameraOpen ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                                Secure your account with Face ID. Required for high-security actions.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={startCamera}
                                                className="action-btn"
                                                style={{ background: 'var(--text-secondary)', marginTop: 0, width: 'auto', padding: '10px 24px' }}
                                                disabled={!isModelLoaded}
                                            >
                                                {isModelLoaded ? 'Start Face Enrollment' : 'Loading...'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="camera-container" style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                                            <video
                                                ref={videoRef}
                                                autoPlay
                                                muted
                                                playsInline
                                                style={{ width: '100%', transform: 'scaleX(-1)', display: 'block' }}
                                            />
                                            <canvas
                                                ref={canvasRef}
                                                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }}
                                            />

                                            {/* Visual Guide Frame & Progress Ring */}
                                            <div style={{
                                                position: 'absolute',
                                                top: '50%', left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                width: '240px', height: '300px', // Slightly larger for ring
                                                pointerEvents: 'none',
                                                zIndex: 20
                                            }}>
                                                {/* Dashed Border (Inner) */}
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '50%', left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    width: '220px', height: '280px',
                                                    border: '3px dashed #a3e635',
                                                    borderRadius: '140px',
                                                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                                                    opacity: stability > 0 ? 1 : 0.5,
                                                    transition: 'opacity 0.3s'
                                                }} className={stability > 0 ? "face-guide-pulse" : ""}></div>

                                                {/* Scanner Line */}
                                                <div className="scan-line" style={{ top: '10%', width: '180px', left: '30px' }}></div>

                                                {/* Progress Ring (SVG) */}
                                                <svg width="240" height="300" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
                                                    <rect x="0" y="0" width="240" height="300" fill="none" rx="120" ry="120" />
                                                    <rect
                                                        x="0" y="0" width="240" height="300"
                                                        fill="none"
                                                        rx="120" ry="120"
                                                        stroke="#a3e635"
                                                        strokeWidth="6"
                                                        strokeDasharray="850" // Approx perimeter
                                                        strokeDashoffset={850 - (850 * stability / 100)}
                                                        strokeLinecap="round"
                                                        style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                                                    />
                                                </svg>
                                            </div>

                                            {/* Top Status Bar (Feedback) */}
                                            <div style={{ position: 'absolute', top: 20, left: 0, width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', zIndex: 15 }}>
                                                <div style={{
                                                    background: stability > 0 ? 'rgba(163, 230, 53, 0.2)' : 'rgba(0,0,0,0.6)',
                                                    color: stability > 0 ? '#a3e635' : '#fff',
                                                    padding: '6px 16px',
                                                    borderRadius: '20px',
                                                    fontSize: '0.9rem',
                                                    backdropFilter: 'blur(4px)',
                                                    border: `1px solid ${stability > 0 ? '#a3e635' : 'rgba(255,255,255,0.1)'}`,
                                                    transition: 'all 0.3s ease',
                                                    maxWidth: '80%',
                                                    textAlign: 'center'
                                                }}>
                                                    {faceFeedback}
                                                </div>
                                            </div>

                                            {/* Overlay Controls */}
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', padding: '16px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                {/* Stability Indicator */}
                                                {stability > 0 && !isCapturing && (
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `conic-gradient(#a3e635 ${stability}%, rgba(255,255,255,0.2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s linear' }}>
                                                        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                            <span style={{ fontSize: '0.65rem', color: '#fff' }}>{Math.round(stability)}%</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {isCapturing && (
                                                    <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.2)', borderRadius: '3px', overflow: 'hidden' }}>
                                                        <div style={{ width: `${scanProgress}%`, height: '100%', background: '#a3e635', transition: 'width 0.1s linear' }}></div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div style={{ color: 'var(--text-accent)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <div style={{ background: 'var(--text-accent)', borderRadius: '50%', padding: '8px', display: 'flex' }}>
                                        <Check size={24} color="white" strokeWidth={3} />
                                    </div>
                                    <span style={{ fontWeight: '600' }}>Face Enrolled Successfully</span>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, faceDescriptor: null }))}
                                        style={{ marginTop: '4px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
                                    >
                                        Remove & Retake
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    <button type="submit" className="action-btn" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Create Store & Owner Account'}
                    </button>
                </form>

                {/* Footer */}
                <div className="auth-footer">
                    <p>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); onBack(); }}>Back to Login</a></p>
                </div>
            </div>
        </div>
    );
};

export default Register;
