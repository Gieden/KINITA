import React from 'react';
import { LayoutDashboard, Package, Users, Receipt, Settings, ArrowLeftRight, FileText } from 'lucide-react';
import './Sidebar.css';

const Sidebar = ({ activeTab, setActiveTab, userRole }) => {
    let menuItems = [
        { name: 'Dashboard', icon: LayoutDashboard },
        { name: 'POS', icon: Receipt },
        { name: 'Inventory', icon: Package },
        { name: 'Staff Management', icon: Users },
        { name: 'Transactions', icon: ArrowLeftRight },
        { name: 'Deep Reports', icon: FileText },
        { name: 'Settings', icon: Settings },
    ];

    // Role-based restrictions
    if (userRole === 'Cashier') {
        const excluded = ['Staff Management', 'Transactions', 'Deep Reports', 'Dashboard'];
        menuItems = menuItems.filter(item => !excluded.includes(item.name));
    } else if (userRole !== 'Owner') {
        // Hide Owner-exclusive tabs for non-Owners (e.g. Staff, if any other roles exist)
        menuItems = menuItems.filter(item => item.name !== 'Transactions' && item.name !== 'Deep Reports');
    }
    return (
        <aside className="sidebar">
            <div className="logo-container">
                <img src="/logo.svg" alt="KINITA" className="logo-img" />
                <span className="logo-text">KINITA</span>
            </div>

            <div className="menu-label">MENU</div>

            <nav className="nav-menu">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.name;

                    return (
                        <button
                            key={item.name}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActiveTab(item.name)}
                        >
                            <Icon size={20} className="nav-icon" />
                            <span>{item.name}</span>
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default Sidebar;
