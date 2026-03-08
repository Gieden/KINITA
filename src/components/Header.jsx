import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User as UserIcon, Settings, ChevronDown, Moon, Sun } from 'lucide-react';
import './Header.css';

const Header = ({ user, role, onLogout, systemHealth, theme, toggleTheme }) => {
    const [showMenu, setShowMenu] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const getInitials = (name) => {
        if (!name) return 'U';
        return name.charAt(0).toUpperCase();
    };

    // Generate a consistent background color based on name
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
        <header className="top-header">
            <div className="connectivity-indicator">
                <div className={`status-node ${systemHealth.serverOnline ? 'online' : 'offline'}`} title="XAMPP MySQL Server Status">
                    <div className="status-light"></div>
                    <span className="status-label">MySQL</span>
                </div>
                <div className={`status-node ${systemHealth.localOnline ? 'online' : 'offline'}`} title="Local SQLite Engine Status">
                    <div className="status-light"></div>
                    <span className="status-label">Local</span>
                </div>
                <div className={`status-node ${systemHealth.dbExists ? 'online' : 'offline'}`} title={`Active connection via: ${systemHealth.systemType}`}>
                    <div className="status-light"></div>
                    <span className="status-label">Gateway</span>
                </div>
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                    onClick={toggleTheme}
                    className="theme-toggle glass-panel"
                    style={{
                        width: '40px',
                        height: '40px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                        border: 'var(--glass-border)',
                        background: 'var(--card-bg)',
                        borderRadius: '12px'
                    }}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>

                <div className="profile-wrapper" ref={dropdownRef}>
                    <div
                        className={`user-profile glass-panel ${showMenu ? 'active' : ''}`}
                        onClick={() => setShowMenu(!showMenu)}
                    >
                        <div className="user-info">
                            <span className="user-name">{user}</span>
                            <span className="user-role">{role}</span>
                        </div>

                        <div
                            className="user-avatar-initials"
                            style={{ backgroundColor: getAvatarColor(user) }}
                        >
                            {getInitials(user)}
                        </div>


                        <ChevronDown size={14} className={`chevron ${showMenu ? 'rotate' : ''}`} />
                    </div>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="profile-dropdown glass-panel">
                            {/* Avatar change option removed */}
                            <div className="dropdown-item">
                                <Settings size={16} />
                                <span>Settings</span>
                            </div>
                            <div className="dropdown-divider"></div>
                            <div className="dropdown-item logout" onClick={onLogout}>
                                <LogOut size={16} />
                                <span className="status-label">Log Out</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
