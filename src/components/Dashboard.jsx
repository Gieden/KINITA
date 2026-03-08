import React, { useState, useEffect } from 'react';
import { ShoppingCart, Coins, AlertTriangle, Download, Calendar } from 'lucide-react';
import './Dashboard.css';

const Dashboard = ({ user }) => {
    const [stats, setStats] = useState({
        revenue: 0,
        sales_count: 0,
        sold_items: 0,
        top_selling: [],
        stock_status: { low: 0, out: 0, expiry: 0 }
    });
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('this_month');
    const [showPeriodDropdown, setShowPeriodDropdown] = useState(false);

    const periodOptions = [
        { value: 'today', label: 'Today' },
        { value: 'this_week', label: 'This Week' },
        { value: 'this_month', label: 'This Month' },
        { value: 'this_year', label: 'This Year' },
        { value: 'all_time', label: 'All Time' }
    ];

    const getComparisonText = () => {
        switch (period) {
            case 'today': return 'vs yesterday';
            case 'this_week': return 'vs last week';
            case 'this_month': return 'vs last month';
            case 'this_year': return 'vs last year';
            case 'all_time': return 'overall';
            default: return 'vs previous period';
        }
    };

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/kinita/public/api/dashboard.php?period=${period}`);
                const data = await res.json();
                setStats(data);
            } catch (err) {
                console.error("Error fetching dashboard stats:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [period]);

    return (
        <div className="dashboard-container fade-in">

            {/* Title Section */}
            <div className="dashboard-header">
                <div className="title-group">
                    <div className="icon-badge">
                        <LayoutIcon />
                    </div>
                    <h1>Dashboard</h1>
                </div>

                <div className="actions-group">
                    <div className="dropdown-container">
                        <button
                            className="glass-btn"
                            onClick={() => setShowPeriodDropdown(!showPeriodDropdown)}
                        >
                            {periodOptions.find(p => p.value === period)?.label || 'This Month'} <Calendar size={16} />
                        </button>
                        {showPeriodDropdown && (
                            <div className="period-dropdown glass-panel fade-in">
                                {periodOptions.map(opt => (
                                    <button
                                        key={opt.value}
                                        className={`dropdown-item ${period === opt.value ? 'active' : ''}`}
                                        onClick={() => {
                                            setPeriod(opt.value);
                                            setShowPeriodDropdown(false);
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <button className="primary-btn">
                        <Download size={16} /> Download Report
                    </button>
                </div>
            </div>

            {/* Top Section: Stats & Layout */}
            <div className="layout-grid-top">
                {/* Revenue Card - span 1 */}
                <div className="glass-panel revenue-high-card">
                    <div className="card-header-icon">
                        <Coins size={20} />
                    </div>
                    <span className="label">Total Revenue</span>
                    <div className="amount-container">
                        <span className="currency">₱</span>
                        <span className="amount">{parseFloat(stats.revenue).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="badge-row">
                        {period !== 'all_time' && (
                            <span className="trend-badge positive">
                                ↗ +0.0%
                            </span>
                        )}
                        <span className="subtext">{getComparisonText()}</span>
                    </div>
                </div>

                {/* Total Sales Card */}
                <StatCardReference
                    icon={<ShoppingCart size={20} />}
                    label="Total Sales"
                    value={stats.sales_count}
                    change={period === 'all_time' ? null : "+0.0%"}
                    comparisonText={getComparisonText()}
                />

                {/* Sold Items Card */}
                <StatCardReference
                    icon={<Coins size={20} />}
                    label="Sold Items"
                    value={stats.sold_items}
                    change={period === 'all_time' ? null : "+0.0%"}
                    comparisonText={getComparisonText()}
                />
            </div>

            {/* Main Content Grid */}
            <div className="main-layout-grid">

                {/* Left Column: Top Selling */}
                <div className="glass-panel table-section">
                    <h3>Top Selling Products</h3>
                    <div className="table-header">
                        <span>PRODUCTS</span>
                        <span>TYPE</span>
                        <span>SOLD</span>
                    </div>
                    <div className="product-list">
                        {loading ? (
                            <p style={{ padding: 20, textAlign: 'center' }}>Loading...</p>
                        ) : (
                            stats.top_selling && stats.top_selling.length > 0 ? (
                                stats.top_selling.map((item, index) => (
                                    <ProductRow
                                        key={index}
                                        name={`${index + 1}. ${item.Product_Name}`}
                                        type={item.Category_Name || 'General'}
                                        sold={item.sold}
                                    />
                                ))
                            ) : (
                                <p style={{ padding: 20, textAlign: 'center', color: 'var(--text-secondary)' }}>No sales yet.</p>
                            )
                        )}
                    </div>
                </div>

                {/* Right Column: Stock & Staff */}
                <div className="right-column-stack">

                    {/* Stock Status */}
                    <div className="glass-panel stock-status-card">
                        <h3>Stock Status</h3>
                        <div className="stock-circles">
                            <StockCircle color="yellow" count={stats.stock_status.low} label="Low Stock" icon={<AlertTriangle size={20} />} />
                            <StockCircle color="red" count={stats.stock_status.out} label="Out of Stock" icon={<AlertTriangle size={20} />} />
                            <StockCircle color="orange" count={stats.stock_status.expiry} label="Near Expiry" icon={<Download size={20} />} />
                        </div>
                    </div>

                    {/* On-Duty Staff */}
                    <div className="glass-panel staff-list-card">
                        <h3>On-Duty Staff</h3>
                        <div className="staff-list">
                            <StaffRow
                                name={user?.name || "System Owner"}
                                role={user?.role || "Owner"}
                                avatarSeed={user?.name || "Felix"}
                            />
                        </div>
                    </div>

                </div>
            </div>

        </div>
    );
};

// Helper Components for Reference Match
const StatCardReference = ({ icon, label, value, change, comparisonText }) => (
    <div className="glass-panel stat-card-ref">
        <div className="card-header-icon sm">
            {icon}
        </div>
        <div className="stat-content-ref">
            <span className="label">{label}</span>
            <div className="value-row">
                <span className="value">{value}</span>
            </div>
            <div className="badge-row">
                {change && <span className="trend-badge positive-light">{change}</span>}
                <span className="subtext">{comparisonText || 'vs previous period'}</span>
            </div>
        </div>
    </div>
);

const StockCircle = ({ color, count, label, icon }) => (
    <div className="stock-item">
        <div className={`circle-icon ${color}`}>
            {icon}
        </div>
        <div className="stock-info">
            <span className="count">{count} Items</span>
            <span className="label">{label}</span>
        </div>
    </div>
);

const StaffRow = ({ name, role, avatarSeed }) => (
    <div className="staff-row">
        <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeed}`}
            className="staff-avatar"
            alt="staff"
        />
        <div className="staff-info">
            <span className="name">{name}</span>
            <span className="role">{role}</span>
        </div>
    </div>
);

const ProductRow = ({ name, type, sold }) => (
    <div className="product-row">
        <span className="p-name">{name}</span>
        <span className="p-type">{type}</span>
        <span className="p-sold">{sold}</span>
    </div>
);

const LayoutIcon = () => (
    <div className="dashboard-icon-circle">
        <div className="inner-rect"></div>
    </div>
);

export default Dashboard;
