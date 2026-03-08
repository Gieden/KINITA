import React, { useState, useEffect } from 'react';
import { Plus, User, Mail, Phone, X, ChevronDown, Eye, EyeOff, Search, Loader2 } from 'lucide-react';
import { getApiBase } from '../utils/api';
import { loadModels, getFaceDescriptor, getAverageFaceDescriptor, detectFace, drawFaceRect, checkForDuplicateFace, checkBrightness } from '../utils/FaceAuth';
import { useCamera } from '../hooks/useCamera';
import './StaffManagement.css';

const StaffManagement = ({ currentUserId, onUpdateUser }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [createLogin, setCreateLogin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [activeActionId, setActiveActionId] = useState(null);
    const [editingStaffId, setEditingStaffId] = useState(null);

    // Data State
    const [staffList, setStaffList] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');

    const filteredStaff = staffList.filter(staff =>
        (staff.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.role || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        contact: '',
        role: 'Cashier',
        username: '',
        password: '',
        faceDescriptor: null
    });

    // Face Auth State
    const { videoRef, isCameraOpen, startCamera, stopCamera, error: cameraError } = useCamera();
    const [isModelLoaded, setIsModelLoaded] = useState(false);
    const canvasRef = React.useRef(null);
    const [faceFeedback, setFaceFeedback] = useState("Position your face in the frame");
    const [isLowLight, setIsLowLight] = useState(false);
    const detectionLoopRef = React.useRef(null);
    const lastBrightnessCheck = React.useRef(0);

    useEffect(() => {
        let isActive = true;

        const loop = async () => {
            if (!isActive) return;

            if (isCameraOpen) {
                setLoopCount(prev => prev + 1);

                try {
                    if (!videoRef.current) throw new Error("Video Ref Null");

                    // Force play if paused
                    if (videoRef.current.paused) {
                        try { await videoRef.current.play(); } catch (e) { /* ignore play error */ }
                    }

                    // Resize canvas to match video if needed
                    if (videoRef.current.readyState >= 1) {
                        const vw = videoRef.current.videoWidth;
                        const vh = videoRef.current.videoHeight;
                        setVideoSize(`${vw}x${vh}`);

                        if (vw > 0 && vh > 0 && canvasRef.current) {
                            if (canvasRef.current.width !== vw || canvasRef.current.height !== vh) {
                                canvasRef.current.width = vw;
                                canvasRef.current.height = vh;
                            }
                        }
                    }

                    // Ensure video is ready
                    if (videoRef.current.readyState >= 2) {
                        setTrace('T:Detect');

                        // Timeout Wrapper
                        const detectPromise = detectFace(videoRef.current);
                        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000));

                        const detection = await Promise.race([detectPromise, timeoutPromise]);

                        setTrace('T:End');

                        if (canvasRef.current) {
                            const ctx = canvasRef.current.getContext('2d');
                            if (detection && detection.box) {
                                setDetectionSource(detection.source || 'Unknown');
                                setHasBox('YES');
                                setFeatures(detection.features || { face: true, leftEye: true, rightEye: true, nose: true });
                                drawFaceRect(canvasRef.current, detection);
                                // Verify face is big enough and centered (simple check for now)
                                setFaceFeedback("Face detected! Hold still...");
                                setStability(prev => Math.min(prev + (100 / STABILITY_THRESHOLD), 100));
                            } else {
                                // Show debug info even if no face found
                                setDetectionSource(detection?.source || 'NONE');
                                setHasBox('NO');
                                setFeatures(detection?.features || { face: false, leftEye: false, rightEye: false, nose: false });

                                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                                setFaceFeedback("Looking for face...");
                                setStability(0);
                            }
                        }
                    } else {
                        setDetectionSource("Waiting for Video...");
                    }
                } catch (e) {
                    console.warn("Loop Error", e);
                    setDetectionSource(`CRASH: ${e.message}`);
                }
            }

            if (isActive) {
                detectionLoopRef.current = requestAnimationFrame(loop);
            }
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
    }, [isCameraOpen, videoRef]);

    useEffect(() => {
        loadModels().then(() => setIsModelLoaded(true));
    }, []);

    const [stability, setStability] = useState(0);
    const [isCapturing, setIsCapturing] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [detectionSource, setDetectionSource] = useState('NONE');
    const [videoSize, setVideoSize] = useState('0x0');
    const [loopCount, setLoopCount] = useState(0);
    const [trace, setTrace] = useState('0');
    const [hasBox, setHasBox] = useState('NO');
    const [features, setFeatures] = useState({ face: false, leftEye: false, rightEye: false, nose: false });
    const STABILITY_THRESHOLD = 20; // Faster auto-capture (approx 0.7s)

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
            const duplicateUser = checkForDuplicateFace(descriptor, staffList);
            if (duplicateUser) {
                alert(`Face already registered to: ${duplicateUser.name}`);
                setFaceFeedback(`Face already registered to ${duplicateUser.name}`);
                setStability(0);
                setIsCapturing(false);
                setScanProgress(0);
                stopCamera();
                return;
            }

            setFormData(prev => ({ ...prev, faceDescriptor: Array.from(descriptor) }));
            stopCamera();
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
        } catch (err) {
            console.warn("Auto-capture failed", err);
            setFaceFeedback("Capture failed. Try again.");
            setStability(0);
            setIsCapturing(false);
            setScanProgress(0);
        }
    }, [videoRef, stopCamera, staffList, isCapturing]);

    useEffect(() => {
        // Auto-capture trigger
        if (stability >= 100) {
            captureFace();
        }
    }, [stability, captureFace]);

    useEffect(() => {
        fetchStaff();

        const handleClickOutside = () => setActiveActionId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const fetchStaff = async () => {
        try {
            const apiBase = getApiBase();
            let data;

            if (apiBase) {
                const response = await fetch(`${apiBase}/get_staff.php`);
                data = await response.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.getStaff();
            }

            if (Array.isArray(data)) {
                // Ensure data from PHP matches expected format
                const formatted = data.map(s => ({
                    ...s,
                    name: s.name || s.full_name || 'Unknown',
                    email: s.email || '',
                    contact: s.contact_number || s.contact || '',
                    role: s.position || s.role || 'Cashier',
                    status: s.status || 'Active'
                }));
                setStaffList(formatted);
            }
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditClick = (staff) => {
        setEditingStaffId(staff.id);
        setFormData({
            id: staff.id,
            name: staff.name || staff.full_name,
            email: staff.email,
            contact: staff.contact,
            role: staff.role,
            username: staff.username || '',
            password: '••••••', // Placeholder
            faceDescriptor: staff.face_descriptor ? [] : null // Just a marker to show they have one? actually complex. Let's just reset it for now or check backend support. 
            // Better: We don't fetch descriptors in get-staff list usually to save bandwidth.
            // For now, let's assume if they edit, they can re-enroll if they want.
        });
        setCreateLogin(!!staff.username);
        setPreviewUrl(staff.profile_picture || null); // Show existing picture
        setSelectedFile(null);
        setIsModalOpen(true);
        setActiveActionId(null);
    };

    const handleDeleteStaff = async (id) => {
        if (!window.confirm("Are you sure you want to delete this staff member?")) return;

        try {
            const apiBase = getApiBase();
            let result;

            if (apiBase) {
                const response = await fetch(`${apiBase}/delete_staff.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                });
                result = await response.json();
            } else if (window.electronAPI) {
                result = await window.electronAPI.deleteStaff(id);
            }

            if (result.status === 'success') {
                fetchStaff();
                setActiveActionId(null);
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error deleting staff:', error);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // File Upload State
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            ...formData,
            // If createLogin is false, clear out username/password just in case
            username: createLogin ? formData.username : '',
            password: createLogin ? formData.password : ''
        };

        try {
            const apiBase = getApiBase();
            const endpoint = editingStaffId ? 'update_staff.php' : 'add_staff.php';
            let result;

            // 1. Save/Update Staff Details
            if (apiBase) {
                const response = await fetch(`${apiBase}/${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const text = await response.text();
                try {
                    result = JSON.parse(text);
                } catch (e) {
                    console.error('Server returned non-JSON:', text);
                    alert(`Server Error: ${text.substring(0, 100)}...`);
                    throw new Error('Server returned invalid response');
                }
            } else if (window.electronAPI) {
                result = editingStaffId
                    ? await window.electronAPI.updateStaff(payload)
                    : await window.electronAPI.addStaff(payload);
            }

            if (result.status === 'success') {
                const staffId = editingStaffId || result.id || (result.data && result.data.id); // Get ID from response

                // 2. Upload Profile Picture (if selected)
                if (selectedFile && staffId) {
                    const formDataUpload = new FormData();
                    formDataUpload.append('profile_picture', selectedFile);
                    formDataUpload.append('user_id', staffId);

                    await fetch(`${apiBase}/upload_profile.php`, {
                        method: 'POST',
                        body: formDataUpload
                    });

                    // SYNC: If we just updated the CURRENT user, update global app state immediately
                    if (onUpdateUser && Number(staffId) === Number(currentUserId)) {
                        // Let's do a quick fetch of the updated staff data to get the exact URL from DB
                        try {
                            const verifyResponse = await fetch(`${apiBase}/get_staff.php`);
                            const verifyData = await verifyResponse.json();
                            const updatedSelf = verifyData.find(u => Number(u.id) === Number(staffId));
                            if (updatedSelf) {
                                onUpdateUser({ profile_picture: updatedSelf.profile_picture });
                            }
                        } catch (err) {
                            console.warn("Failed to sync header avatar immediately", err);
                        }
                    }
                }

                setIsModalOpen(false);
                setEditingStaffId(null);
                setFormData({
                    name: '',
                    email: '',
                    contact: '',
                    role: 'Cashier',
                    username: '',
                    password: ''
                });
                setCreateLogin(false);
                setSelectedFile(null);
                setPreviewUrl(null);

                await fetchStaff(); // Wait for list to refresh
                alert(editingStaffId ? 'Staff updated successfully!' : 'Staff added successfully!');
            } else {
                alert(result.message || 'Action failed');
            }
        } catch (error) {
            console.error('Error processed staff:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.charAt(0).toUpperCase();
    };

    const getAvatarColor = (name) => {
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899'];
        let hash = 0;
        if (!name) return colors[0];
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    return (
        <div className="staff-container">

            {/* Header / Toolbar */}
            <div className="staff-header">
                <h2 className="page-title">Staff Management</h2>
                <div className="header-actions">
                    <button className="add-staff-btn" onClick={() => {
                        setFormData({
                            name: '',
                            email: '',
                            contact: '',
                            role: 'Cashier',
                            username: '',
                            password: ''
                        });
                        setCreateLogin(false);
                        setIsModalOpen(true);
                    }}>
                        <Plus size={18} />
                        <span>Add New Staff</span>
                    </button>
                    <div className="search-bar glass-field">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search staff..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Staff Table */}
            <div className="glass-panel table-container">
                {loading ? (
                    <div className="loading-state">
                        <Loader2 className="spinner" size={32} />
                        <p>Loading staff...</p>
                    </div>
                ) : (
                    <table className="staff-table">
                        <thead>
                            <tr>
                                <th>Profile</th>
                                <th>Role</th>
                                <th>Contact</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStaff.length > 0 ? (
                                filteredStaff.map((staff) => (
                                    <tr key={staff.id}>
                                        <td className="profile-cell">
                                            <div
                                                className="avatar-initials"
                                                style={{ backgroundColor: getAvatarColor(staff.name) }}
                                            >
                                                {getInitials(staff.name)}
                                            </div>

                                            <div className="profile-info">
                                                <span className="name">{staff.name}</span>
                                                <span className="email">{staff.email}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${staff.role.toLowerCase()}`}>
                                                {staff.role}
                                            </span>
                                        </td>
                                        <td className="contact-cell">{staff.contact}</td>
                                        <td>
                                            <span className={`status-dot ${staff.status === 'Active' ? 'active' : 'inactive'}`}></span>
                                            {staff.status}
                                        </td>
                                        <td className="actions-cell">
                                            <button className="action-dots" onClick={(e) => { e.stopPropagation(); setActiveActionId(activeActionId === staff.id ? null : staff.id); }}>•••</button>
                                            {activeActionId === staff.id && (
                                                <div className="action-dropdown glass-panel">
                                                    <button onClick={() => handleEditClick(staff)}>Edit Details</button>
                                                    {staff.role !== 'Owner' && (
                                                        <button className="delete-opt" onClick={() => handleDeleteStaff(staff.id)}>Delete Staff</button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="empty-state">No staff members found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>


            {/* Add Staff Modal */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                            <X size={20} />
                        </button>

                        <div className="modal-header">
                            <h3>{editingStaffId ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
                            <p>{editingStaffId ? 'Update employee information and credentials.' : 'Enter details to onboard a new employee.'}</p>
                        </div>

                        <form className="modal-form" onSubmit={handleSubmit}>
                            <div className="input-row">
                                <div className="field-group">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        name="name"
                                        className="modal-input"
                                        placeholder="e.g. Juan Dela Cruz"
                                        value={formData.name}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-grid">
                                <div className="field-group">
                                    <label>Email Address</label>
                                    <input
                                        type="email"
                                        name="email"
                                        className="modal-input"
                                        placeholder="email@domain.com"
                                        value={formData.email}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                                <div className="field-group">
                                    <label>Contact Number</label>
                                    <input
                                        type="text"
                                        name="contact"
                                        className="modal-input"
                                        placeholder="+63 900 000 0000"
                                        value={formData.contact}
                                        onChange={handleInputChange}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="field-group">
                                <label>Role Assignment</label>
                                <div className="select-wrapper">
                                    <select
                                        className="modal-input"
                                        name="role"
                                        value={formData.role}
                                        onChange={handleInputChange}
                                    >
                                        <option value="Cashier">Cashier</option>
                                        <option value="Manager">Manager</option>
                                    </select>
                                    <ChevronDown size={16} className="select-icon" />
                                </div>
                            </div>

                            <div className="toggle-section">
                                <div className="toggle-label">
                                    <label className="switch">
                                        <input
                                            type="checkbox"
                                            checked={createLogin}
                                            onChange={() => setCreateLogin(!createLogin)}
                                        />
                                        <span className="slider round"></span>
                                    </label>
                                    <span>Create Login Credentials</span>
                                </div>
                            </div>

                            {createLogin && (
                                <div className="credentials-group">
                                    <div className="input-grid">
                                        <div className="field-group">
                                            <label>Username</label>
                                            <input
                                                type="text"
                                                name="username"
                                                className="modal-input"
                                                placeholder="username"
                                                value={formData.username}
                                                onChange={handleInputChange}
                                                required={createLogin}
                                            />
                                        </div>
                                        <div className="field-group">
                                            <label>Password</label>
                                            <div className="password-wrapper">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    name="password"
                                                    className="modal-input"
                                                    placeholder="••••••"
                                                    value={formData.password}
                                                    onChange={handleInputChange}
                                                    required={createLogin}
                                                />
                                                <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="input-field-wrapper" style={{ marginBottom: '20px' }}>
                                <label>Biometric Enrollment (Optional)</label>
                                <div className="glass-panel" style={{ padding: '16px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    {!formData.faceDescriptor ? (
                                        <>
                                            {!isCameraOpen ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                                        Enable Face ID for this staff member.
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={startCamera}
                                                        className="seal-btn"
                                                        style={{ background: 'rgba(255,255,255,0.1)', marginTop: 0, width: 'auto', padding: '8px 20px', height: 'auto', color: '#fff' }}
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
                                                        onLoadedMetadata={() => {
                                                            if (canvasRef.current && videoRef.current) {
                                                                canvasRef.current.width = videoRef.current.videoWidth;
                                                                canvasRef.current.height = videoRef.current.videoHeight;
                                                            }
                                                        }}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: isLowLight ? 0.5 : 1 }}
                                                    />
                                                    <canvas
                                                        ref={canvasRef}
                                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }}
                                                    />

                                                    {/* Visual Guide Frame */}

                                                    {/* Visual Guide Frame */}
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
                                                                background: 'rgba(255,255,255,0.1)',
                                                                color: 'rgba(255,255,255,0.3)',
                                                                padding: '8px 24px',
                                                                zIndex: 10,
                                                                pointerEvents: 'none'
                                                            }}
                                                        >
                                                            {isCapturing ? 'Scanning...' : (stability >= 100 ? 'Capturing...' : 'Hold Still...')}
                                                        </button>


                                                        {/* Stability Indicator */}
                                                        {stability > 0 && (
                                                            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `conic-gradient(#a3e635 ${stability}%, rgba(255,255,255,0.2) 0)`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s linear' }}>
                                                                <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#222', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                    <span style={{ fontSize: '0.65rem', color: '#fff' }}>{Math.round(stability)}%</span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div style={{ color: '#a3e635', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <div style={{ background: 'rgba(163, 230, 53, 0.2)', borderRadius: '50%', padding: '8px', display: 'flex' }}>
                                                <Eye size={24} color="#a3e635" strokeWidth={3} />
                                            </div>
                                            <span style={{ fontWeight: '600' }}>Face Enrolled Successfully</span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(prev => ({ ...prev, faceDescriptor: null }))}
                                                style={{ marginTop: '4px', background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}
                                            >
                                                Remove & Retake
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="cancel-btn" onClick={() => { setIsModalOpen(false); setIsCameraOpen(false); }}>Cancel</button>
                                <button type="submit" className="submit-btn" disabled={submitting}>
                                    {submitting ? 'Saving...' : (editingStaffId ? 'Update Staff' : 'Add Staff Member')}
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

        </div>
    );
};

export default StaffManagement;
