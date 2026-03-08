import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Plus, Minus, Trash2, CreditCard, Box, X } from 'lucide-react';
import { fetchApi } from '../utils/api';
import './POS.css';

const POS = ({ user }) => {
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const searchInputRef = useRef(null);

    // Fetch Products on Mount
    useEffect(() => {
        fetchProducts();
    }, []);

    // Focus search on mount
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    const fetchProducts = async () => {
        try {
            const isSatellite = localStorage.getItem('kinita_server_ip');
            const isMysqlSync = localStorage.getItem('kinita_sync_mode') === 'mysql';

            if (window.electronAPI && !isSatellite && !isMysqlSync) {
                const data = await window.electronAPI.getProducts();
                if (Array.isArray(data)) {
                    setProducts(data);
                }
                return;
            }

            const response = await fetchApi('products.php');
            const data = await response.json();
            if (Array.isArray(data)) {
                setProducts(data);
            }
        } catch (error) {
            console.error("Error fetching products:", error);
        }
    };

    // Add to Cart Logic
    const addToCart = (product) => {
        if (parseInt(product.Current_Stock) <= 0) {
            alert("Out of stock!");
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.Product_ID === product.Product_ID);
            if (existing) {
                if (existing.quantity >= parseInt(product.Current_Stock)) {
                    alert("Not enough stock!");
                    return prev;
                }
                return prev.map(item =>
                    item.Product_ID === product.Product_ID
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            } else {
                return [...prev, { ...product, quantity: 1 }];
            }
        });
    };

    const removeFromCart = (productId) => {
        setCart(prev => prev.filter(item => item.Product_ID !== productId));
    };

    const updateQuantity = (productId, change) => {
        setCart(prev => prev.map(item => {
            if (item.Product_ID === productId) {
                const newQty = item.quantity + change;
                if (newQty > 0) {
                    // Check stock limit
                    const product = products.find(p => p.Product_ID === productId);
                    if (product && newQty > parseInt(product.Current_Stock)) {
                        alert("Max stock reached!");
                        return item;
                    }
                    return { ...item, quantity: newQty };
                }
                return item;
            }
            return item;
        }));
    };

    // Handle Barcode Search
    const handleSearchCheck = (e) => {
        if (e.key === 'Enter') {
            const exactMatch = products.find(p => p.Barcode === searchTerm);
            if (exactMatch) {
                addToCart(exactMatch);
                setSearchTerm(''); // Clear after scan
            }
        }
    };

    // Calculate Totals
    const subtotal = cart.reduce((sum, item) => sum + (parseFloat(item.Current_Price) * item.quantity), 0);
    const tax = subtotal * 0.0; // Assume 0 tax for now
    const total = subtotal + tax;

    // Checkout State
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [amountTendered, setAmountTendered] = useState('');
    const [checkoutStatus, setCheckoutStatus] = useState('idle'); // idle, processing, success, error
    const [lastChange, setLastChange] = useState(0);

    // Helper to get API base URL
    const getApiBase = () => {
        if (process.env.NODE_ENV === 'development') {
            return 'http://localhost/kinita/public/api';
        }
        // For production, assume the API is relative to the current host
        return '/kinita/public/api';
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        setCheckoutStatus('processing');
        setLoading(true);

        const cashierId = user?.employee_id || 1;
        const tendered = parseFloat(amountTendered);

        if (isNaN(tendered) || tendered < total) {
            alert("Insufficient payment!");
            setCheckoutStatus('idle');
            setLoading(false);
            return;
        }

        const payload = {
            action: 'checkout',
            cashier_id: cashierId,
            items: cart.map(item => ({
                product_id: item.Product_ID,
                quantity: item.quantity,
                price: parseFloat(item.Current_Price)
            })),
            amount_total: total,
            amount_tendered: tendered,
            amount_change: tendered - total
        };

        try {
            let result;

            const isSatellite = localStorage.getItem('kinita_server_ip');
            const isMysqlSync = localStorage.getItem('kinita_sync_mode') === 'mysql';

            if (window.electronAPI && !isSatellite && !isMysqlSync) {
                // Standalone Mode: Use Electron IPC
                result = await window.electronAPI.processTransaction(payload);
            } else {
                // Web/Satellite Mode: Use Fetch
                const response = await fetchApi('pos.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                result = await response.json();
            }

            if (result && result.status === 'success') {
                setLastChange(tendered - total);
                setCheckoutStatus('success');
                setCart([]);
                setAmountTendered('');
                fetchProducts();

                // Auto-close after 2 seconds
                setTimeout(() => {
                    setIsCheckoutModalOpen(false);
                    setCheckoutStatus('idle');
                    // Refocus search
                    if (searchInputRef.current) {
                        searchInputRef.current.focus();
                    }
                }, 2000);
            } else {
                alert("Transaction Failed: " + (result?.message || "Unknown error"));
                setCheckoutStatus('error');
            }
        } catch (error) {
            console.error("Checkout Error:", error);
            alert("Network Error");
            setCheckoutStatus('error');
        } finally {
            setLoading(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.Product_Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.Barcode && p.Barcode.includes(searchTerm))
    );

    return (
        <div className="pos-container fade-in">
            {/* Left Side: Product Grid */}
            <div className="pos-left">
                <div className="pos-header">
                    <h2 className="text-gradient">Point of Sale</h2>
                    <div className="pos-search-bar">
                        <Search size={20} color="var(--text-secondary)" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="pos-search-input"
                            placeholder="Scan barcode or search product..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleSearchCheck}
                        />
                    </div>
                </div>

                <div className="product-grid">
                    {filteredProducts.map(product => (
                        <div key={product.Product_ID} className="product-card" onClick={() => addToCart(product)}>
                            <div className="product-image">
                                <Box size={32} color="var(--text-secondary)" />
                            </div>
                            <div className="product-info">
                                <span className="product-name">{product.Product_Name}</span>
                                <span className="product-price">₱{parseFloat(product.Current_Price).toFixed(2)}</span>
                                <span className="product-stock">{product.Current_Stock} in stock</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right Side: Cart */}
            <div className="pos-right">
                <div className="cart-panel">
                    <div className="cart-header">
                        <h3>Current Order</h3>
                        <span className="cart-count">{cart.reduce((a, c) => a + c.quantity, 0)} items</span>
                    </div>

                    <div className="cart-items">
                        {cart.length === 0 ? (
                            <div className="empty-state">
                                <ShoppingCart size={48} opacity={0.2} />
                                <p>Cart is empty</p>
                            </div>
                        ) : cart.map(item => (
                            <div key={item.Product_ID} className="cart-item">
                                <div className="cart-item-info">
                                    <span className="cart-item-name">{item.Product_Name}</span>
                                    <span className="cart-item-price">₱{parseFloat(item.Current_Price).toFixed(2)}</span>
                                </div>
                                <div className="cart-controls">
                                    <button className="qty-btn" onClick={() => updateQuantity(item.Product_ID, -1)}><Minus size={14} /></button>
                                    <span className="qty-val">{item.quantity}</span>
                                    <button className="qty-btn" onClick={() => updateQuantity(item.Product_ID, 1)}><Plus size={14} /></button>
                                    <button className="qty-btn" onClick={() => removeFromCart(item.Product_ID)} style={{ marginLeft: 8, color: '#ff4d4f' }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="cart-footer">
                        <div className="price-row">
                            <span>Subtotal</span>
                            <span>₱{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="price-row total">
                            <span>Total</span>
                            <span>₱{total.toFixed(2)}</span>
                        </div>

                        <button
                            className="btn-checkout"
                            disabled={cart.length === 0 || loading}
                            onClick={() => setIsCheckoutModalOpen(true)}
                        >
                            {loading ? 'Processing...' : 'Charge ₱' + total.toFixed(2)}
                        </button>
                    </div>
                </div>
            </div>

            {/* Checkout Modal */}
            {isCheckoutModalOpen && (
                <div className="modal-overlay" onClick={() => { }}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>

                        {checkoutStatus === 'success' ? (
                            <div className="checkout-success" style={{ textAlign: 'center', padding: '20px' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
                                <h3>Transaction Complete!</h3>
                                <p style={{ fontSize: '18px', color: '#94a3b8' }}>Change Due</p>
                                <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#10b981', margin: '12px 0' }}>
                                    ₱{lastChange.toFixed(2)}
                                </div>
                                <p style={{ fontSize: '14px', color: '#64748b' }}>Window will close automatically...</p>
                            </div>
                        ) : (
                            <>
                                <button className="close-btn" style={{ position: 'absolute', top: '24px', right: '24px' }} onClick={() => setIsCheckoutModalOpen(false)}>
                                    <X size={20} />
                                </button>

                                <div className="modal-header">
                                    <h3>Checkout</h3>
                                </div>

                                <div className="checkout-summary">
                                    <div className="summary-row total">
                                        <span>Total Amount</span>
                                        <span>₱{total.toFixed(2)}</span>
                                    </div>
                                </div>

                                <div className="payment-form">
                                    <label>Amount Tendered</label>
                                    <input
                                        type="text"
                                        inputMode="decimal"
                                        className="modal-input big-input"
                                        value={amountTendered}
                                        onChange={(e) => setAmountTendered(e.target.value.replace(/[^0-9.]/g, ''))}
                                        autoFocus
                                        placeholder="0.00"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCheckout();
                                        }}
                                        disabled={checkoutStatus === 'processing'}
                                    />

                                    <div className="change-display">
                                        <span>Change</span>
                                        <span className={parseFloat(amountTendered) >= total ? 'positive' : 'negative'}>
                                            ₱{amountTendered ? (parseFloat(amountTendered) - total).toFixed(2) : '0.00'}
                                        </span>
                                    </div>

                                    <div className="modal-actions">
                                        <button
                                            className="cancel-btn"
                                            onClick={() => setIsCheckoutModalOpen(false)}
                                            disabled={checkoutStatus === 'processing'}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            className="submit-btn"
                                            onClick={handleCheckout}
                                            disabled={!amountTendered || parseFloat(amountTendered) < total || checkoutStatus === 'processing'}
                                        >
                                            {checkoutStatus === 'processing' ? 'Processing...' : 'Confirm Payment'}
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default POS;
