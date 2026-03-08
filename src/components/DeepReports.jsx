import React, { useState, useEffect } from 'react';
import { getApiBase } from '../utils/api';
import './DeepReports.css';

const DeepReports = () => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState({
        revenue: [],
        income: [], // New state for Profit
        categories: [],
        daily_transactions: []
    });

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        try {
            const apiBase = getApiBase();
            if (!apiBase) {
                setLoading(false);
                return;
            }

            const response = await fetch(`${apiBase}/get_reports.php`);
            const result = await response.json();

            if (result.status === 'success') {
                const cats = result.data.categories || [];
                const total = cats.reduce((acc, c) => acc + (parseInt(c.value) || 0), 0);
                const catsWithPercent = cats.map(c => ({
                    ...c,
                    percentage: total > 0 ? ((c.value / total) * 100).toFixed(1) : 0
                }));

                setData({
                    ...result.data,
                    categories: catsWithPercent
                });
            }
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    // --- Chart Helpers ---

    // 1. Revenue Bar Chart
    const renderRevenueChart = () => {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const maxVal = Math.max(...data.revenue, 100);
        const scaleY = 200 / maxVal;

        return (
            <div className="chart-container">
                <div className="chart-y-axis">
                    <span>₱{Math.round(maxVal)}</span>
                    <span>₱{Math.round(maxVal / 2)}</span>
                    <span>₱0</span>
                </div>
                <div className="chart-bars">
                    {data.revenue.map((val, idx) => (
                        <div key={idx} className="bar-group">
                            <div className="bar-wrapper">
                                {val > 0 && <span className="bar-value">₱{val.toLocaleString()}</span>}
                                <div
                                    className="bar revenue-bar"
                                    style={{ height: `${Math.max(val * scaleY, 2)}px` }}
                                ></div>
                            </div>
                            <span className="bar-label">{months[idx]}</span>
                        </div>
                    ))}
                </div>
                <div className="chart-grid">
                    <div className="grid-line top"></div>
                    <div className="grid-line mid"></div>
                    <div className="grid-line bottom"></div>
                </div>
            </div>
        );
    };

    // 1.5 Income (Profit) Bar Chart - Green
    const renderIncomeChart = () => {
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        // Ensure data.income exists (backwards compatibility)
        const incomeData = data.income || [];
        const maxVal = Math.max(...incomeData, 100);
        const scaleY = 200 / maxVal;

        return (
            <div className="chart-container">
                <div className="chart-y-axis">
                    <span>₱{Math.round(maxVal)}</span>
                    <span>₱{Math.round(maxVal / 2)}</span>
                    <span>₱0</span>
                </div>
                <div className="chart-bars">
                    {incomeData.map((val, idx) => (
                        <div key={idx} className="bar-group">
                            <div className="bar-wrapper">
                                {val > 0 && <span className="bar-value" style={{ color: '#10b981' }}>₱{val.toLocaleString()}</span>}
                                <div
                                    className="bar revenue-bar"
                                    style={{
                                        height: `${Math.max(val * scaleY, 2)}px`,
                                        background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)' // Green for Profit
                                    }}
                                ></div>
                            </div>
                            <span className="bar-label">{months[idx]}</span>
                        </div>
                    ))}
                </div>
                <div className="chart-grid">
                    <div className="grid-line top"></div>
                    <div className="grid-line mid"></div>
                    <div className="grid-line bottom"></div>
                </div>
            </div>
        );
    };

    // 2. Daily Transactions Chart
    const renderDailyChart = () => {
        const maxVal = Math.max(...data.daily_transactions.map(d => d.count), 10);
        const scaleY = 150 / maxVal;

        return (
            <div className="chart-container small-chart">
                <div className="chart-y-axis">
                    <span>{maxVal}</span>
                    <span>{Math.round(maxVal / 2)}</span>
                    <span>0</span>
                </div>
                <div className="chart-bars" style={{ gap: '20px' }}>
                    {data.daily_transactions.map((day, idx) => (
                        <div key={idx} className="bar-group">
                            <div className="bar-wrapper">
                                <span className="bar-value">{day.count}</span>
                                <div
                                    className="bar daily-bar"
                                    style={{ height: `${Math.max(day.count * scaleY, 2)}px` }}
                                ></div>
                            </div>
                            <span className="bar-label">{day.date.toUpperCase()}</span>
                        </div>
                    ))}
                </div>
                <div className="chart-grid">
                    <div className="grid-line top"></div>
                    <div className="grid-line mid"></div>
                    <div className="grid-line bottom"></div>
                </div>
            </div>
        );
    };

    // 3. Category Pie Chart (SVG)
    const renderCategoryPie = () => {
        const total = data.categories.reduce((acc, cat) => acc + cat.value, 0);
        let cumulativePercent = 0;

        const colors = [
            '#67e8f9', // Cyan
            '#425A70', // Slate
            '#a3e635', // Green (Kinita Brand)
            '#f472b6', // Pink
            '#fb923c', // Orange
            '#818cf8', // Indigo
        ];

        const getCoordinatesForPercent = (percent) => {
            const x = Math.cos(2 * Math.PI * percent);
            const y = Math.sin(2 * Math.PI * percent);
            return [x, y];
        };

        return (
            <div className="pie-chart-wrapper">
                <div className="pie-legend">
                    {data.categories.map((cat, idx) => (
                        <div key={idx} className="legend-item">
                            <div className="legend-dot" style={{ background: colors[idx % colors.length] }}></div>
                            <div className="legend-text">
                                <span className="legend-name">{cat.name}</span>
                                <span className="legend-percent">{cat.percentage}%</span>
                            </div>
                        </div>
                    ))}
                </div>
                <svg viewBox="-1 -1 2 2" className="pie-svg">
                    {data.categories.map((cat, idx) => {
                        const startPercent = cumulativePercent;
                        const slicePercent = cat.value / total;
                        cumulativePercent += slicePercent;
                        const endPercent = cumulativePercent;

                        // Calculate SVG path
                        const [startX, startY] = getCoordinatesForPercent(startPercent);
                        const [endX, endY] = getCoordinatesForPercent(endPercent);
                        const largeArcFlag = slicePercent > 0.5 ? 1 : 0;

                        const pathData = [
                            `M ${startX} ${startY}`, // Move
                            `A 1 1 0 ${largeArcFlag} 1 ${endX} ${endY}`, // Arc
                            `L 0 0`, // Line to Center
                        ].join(' ');

                        return (
                            <path
                                key={idx}
                                d={pathData}
                                fill={colors[idx % colors.length]}
                                stroke="#fff"
                                strokeWidth="0.02" // Tiny border for separation
                            />
                        );
                    })}
                </svg>
            </div>
        );
    };


    return (
        <div className="deep-reports-container fade-in">
            <div className="reports-header">
                <h2>Deep Reports</h2>
            </div>

            {loading ? (
                <div className="loading-state">
                    <p>Analyzing Data...</p>
                </div>
            ) : (
                <div className="reports-grid">
                    {/* Revenue Chart - Full Width */}
                    <div className="report-card revenue-card">
                        <h3>Gross Revenue</h3>
                        <div className="revenue-year">2026</div>
                        {renderRevenueChart()}
                    </div>

                    {/* Income Chart - Full Width */}
                    <div className="report-card revenue-card" style={{ marginTop: '20px' }}>
                        <h3>Net Income (Profit)</h3>
                        <div className="revenue-year">2026</div>
                        {renderIncomeChart()}
                    </div>

                    {/* Bottom Row */}
                    <div className="report-row">
                        {/* Category Sales */}
                        <div className="report-card category-card">
                            <h3>Sales by category</h3>
                            {data.categories.length > 0 ? renderCategoryPie() : <p style={{ textAlign: 'center', marginTop: 40 }}>No sales data available</p>}
                        </div>

                        {/* Daily Transactions */}
                        <div className="report-card daily-card">
                            <h3>Number of Transaction per Day</h3>
                            {renderDailyChart()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DeepReports;
