import React, { useState, useEffect } from 'react';
import { ArrowLeftRight, Search, Download, FileText, X } from 'lucide-react';
import { getApiBase } from '../utils/api';
import './Dashboard.css';
import './Transactions.css';

const Transactions = () => {
    const [activeTab, setActiveTab] = useState('sale'); // 'sale' or 'restock'
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [transactionDetails, setTransactionDetails] = useState([]);
    const [detailsLoading, setDetailsLoading] = useState(false);

    useEffect(() => {
        fetchTransactions();
    }, [activeTab, searchQuery]);

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const apiBase = getApiBase();
            if (!apiBase) {
                // Fallback or handle offline mode if needed
                console.error("No API base found");
                setLoading(false);
                return;
            }

            const response = await fetch(`${apiBase}/get_transactions.php?type=${activeTab}&search=${searchQuery}`);
            const data = await response.json();
            setTransactions(data);
        } catch (error) {
            console.error('Error fetching transactions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleViewDetails = async (transaction) => {
        setSelectedTransaction(transaction);
        setDetailsLoading(true);
        setTransactionDetails([]);

        try {
            const apiBase = getApiBase();
            if (apiBase) {
                const response = await fetch(`${apiBase}/get_transactions.php?type=${activeTab}&id=${transaction.id}`);
                const data = await response.json();
                setTransactionDetails(data);
            }
        } catch (error) {
            console.error("Error fetching details:", error);
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setSelectedTransaction(null);
        setTransactionDetails([]);
    };

    const handleDownload = () => {
        const apiBase = getApiBase();
        if (!apiBase) return;
        const url = `${apiBase}/download_transactions.php?type=${activeTab}&search=${searchQuery}`;
        window.open(url, '_blank');
    };

    return (
        <div className="dashboard-container fade-in">
            <div className="dashboard-header">
                <div className="title-group">
                    <div className="icon-badge">
                        <ArrowLeftRight size={24} />
                    </div>
                    <h1>Transactions</h1>
                </div>
            </div>

            <div className="dashboard-content">
                {/* Search and Download Area */}
                <div className="search-filter-bar">
                    <div className="search-box">
                        <Search size={20} />
                        <input
                            type="text"
                            placeholder="Search transaction"
                            value={searchQuery}
                            onChange={handleSearch}
                        />
                    </div>
                    <button className="download-btn" onClick={handleDownload}>
                        <Download size={20} />
                        Download
                    </button>
                </div>

                {/* Transaction List Card */}
                <div className="content-card">
                    <div className="card-header">
                        <h2>
                            <div className="icon-wrapper">
                                <FileText size={20} />
                            </div>
                            Transaction History
                        </h2>
                        <div className="tab-buttons">
                            <button
                                className={`tab-btn ${activeTab === 'restock' ? 'active' : ''}`}
                                onClick={() => setActiveTab('restock')}
                            >
                                Restock
                            </button>
                            <button
                                className={`tab-btn ${activeTab === 'sale' ? 'active' : ''}`}
                                onClick={() => setActiveTab('sale')}
                            >
                                Sale
                            </button>
                        </div>
                    </div>

                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>TRANSACTION ID</th>
                                    <th>HANDLED BY</th>
                                    <th>DATE</th>
                                    <th>{activeTab === 'sale' ? 'AMOUNT' : 'QUANTITY'}</th>
                                    <th>ACTION</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="5" className="text-center">Loading transactions...</td>
                                    </tr>
                                ) : transactions.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="text-center">No transactions found</td>
                                    </tr>
                                ) : (
                                    transactions.map((tx) => (
                                        <tr key={tx.id}>
                                            <td>{tx.display_id || tx.id}</td>
                                            <td>
                                                <div className="user-info">
                                                    <span className="user-name">{tx.handler_first_name} {tx.handler_last_name}</span>
                                                    <span className="user-role">{tx.handler_role}</span>
                                                </div>
                                            </td>
                                            <td>{tx.date_formatted}</td>
                                            <td>
                                                {activeTab === 'sale'
                                                    ? `₱${parseFloat(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                                                    : `${tx.quantity} units (${tx.product_name || 'Unknown'})`
                                                }
                                            </td>
                                            <td>
                                                <button
                                                    className="action-btn"
                                                    onClick={() => handleViewDetails(tx)}
                                                >
                                                    See details
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {selectedTransaction && (
                <div className="modal-overlay" onClick={closeDetails}>
                    <div className="tx-modal-card" onClick={e => e.stopPropagation()}>
                        <button className="tx-close-btn" onClick={closeDetails}>
                            <X size={24} />
                        </button>

                        <div className="tx-modal-title">
                            {activeTab === 'sale' ? 'Sale Transaction Details' : 'Restock Transaction Details'}
                        </div>

                        <div className="tx-modal-content">
                            {/* Left Column */}
                            <div className="tx-col-left">
                                <div className="tx-section">
                                    <div className="tx-section-title">
                                        {activeTab === 'sale' ? 'SALE INFORMATION' : 'RESTOCK INFORMATION'}
                                    </div>
                                    <div className="tx-info-row">
                                        <span className="tx-label">Transaction Date:</span>
                                        <span className="tx-value">{selectedTransaction.date_formatted}</span>
                                    </div>
                                    <div className="tx-info-row">
                                        <span className="tx-label">Handled By:</span>
                                        <span className="tx-value">
                                            {selectedTransaction.handler_first_name} {selectedTransaction.handler_last_name} ({selectedTransaction.handler_role})
                                        </span>
                                    </div>
                                </div>

                                <div className="tx-section" style={{ marginTop: '24px' }}>
                                    <div className="tx-section-title">
                                        {activeTab === 'sale' ? 'INVENTORY DEDUCTION' : 'STOCK MOVEMENT GENERATED'}
                                    </div>
                                    <div className="tx-deduction-list">
                                        {detailsLoading ? (
                                            <p style={{ fontSize: '14px', color: '#64748b' }}>Loading...</p>
                                        ) : transactionDetails.length === 0 ? (
                                            <p style={{ fontSize: '14px', color: '#64748b' }}>No movements recorded.</p>
                                        ) : (
                                            transactionDetails.map((item, index) => (
                                                <div key={index} className="tx-deduction-item">
                                                    <span className="tx-ded-name">{item.Product_Name}:</span>
                                                    <span className={`tx-ded-qty ${activeTab === 'restock' ? 'positive' : ''}`}>
                                                        {activeTab === 'sale' ? `-${item.Sold_Quantity}` : `+${item.Quantity}`}
                                                    </span>
                                                    <span className="tx-ded-batch">({item.Batch_ID || 'N/A'})</span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="tx-divider"></div>

                            {/* Right Column */}
                            <div className="tx-col-right">
                                <div className="tx-section">
                                    <div className="tx-section-title">
                                        {activeTab === 'sale' ? 'SOLD ITEMS' : 'RESTOCKED ITEMS'}
                                    </div>
                                    {detailsLoading ? (
                                        <p style={{ fontSize: '14px', color: '#64748b' }}>Loading...</p>
                                    ) : (
                                        <table className="tx-items-table">
                                            <thead>
                                                <tr>
                                                    <th>PRODUCT</th>
                                                    <th className={activeTab === 'sale' ? '' : ''}>{activeTab === 'sale' ? 'COST' : 'BATCH ID'}</th>
                                                    <th className="center">QUANTITY</th>
                                                    <th className="right">{activeTab === 'sale' ? 'SUBTOTAL' : 'EXPIRY'}</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {transactionDetails.map((item, index) => (
                                                    <tr key={index}>
                                                        <td>{item.Product_Name}</td>
                                                        {activeTab === 'sale' ? (
                                                            <>
                                                                <td>₱{parseFloat(item.Sold_Price).toFixed(2)}</td>
                                                                <td className="center">{item.Sold_Quantity}</td>
                                                                <td className="right">₱{parseFloat(item.Subtotal).toFixed(2)}</td>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <td>{item.Batch_ID || 'N/A'}</td>
                                                                <td className="center">{item.Quantity}</td>
                                                                <td className="right">{item.Expiry_Date || 'N/A'}</td>
                                                            </>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}

                                    {activeTab === 'sale' && !detailsLoading && transactionDetails.length > 0 && (
                                        <div className="tx-total-row">
                                            <span>TOTAL: ₱{parseFloat(selectedTransaction.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                </div>

                                {activeTab === 'sale' && (
                                    <div className="tx-section tx-payment-section">
                                        <div className="tx-section-title">PAYMENT DETAILS</div>
                                        <div className="tx-info-row">
                                            <span className="tx-label">Payment Method:</span>
                                            <span className="tx-value font-bold">{selectedTransaction.payment_method || 'Cash'}</span>
                                        </div>
                                        <div className="tx-info-row">
                                            <span className="tx-label">Amount Paid:</span>
                                            <span className="tx-value">₱{parseFloat(selectedTransaction.amount_tendered || selectedTransaction.amount).toFixed(2)}</span>
                                        </div>
                                        <div className="tx-info-row">
                                            <span className="tx-label">Change Given:</span>
                                            <span className="tx-value">₱{parseFloat(selectedTransaction.amount_change || 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Transactions;
