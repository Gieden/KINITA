import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import './Dashboard.css';

const Settings = () => {
    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header">
                <div className="title-group">
                    <div className="icon-badge">
                        <SettingsIcon size={24} />
                    </div>
                    <h1>Settings</h1>
                </div>
            </div>

            {/* Content cleared as requested */}
        </div>
    );
};

export default Settings;
