import React, { useState, useEffect } from 'react';
import { Search, Plus, Package, AlertCircle, AlertTriangle, Archive, Edit, Trash2, Filter, ArrowUpDown, Truck, Database, X, ChevronDown, ChevronRight, ChevronDown as ChevronDownIcon, Clock } from 'lucide-react';
import { getApiBase } from '../utils/api';
import './Inventory.css';

const Inventory = ({ user }) => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'Product_Name', direction: 'asc' });

    // Batch View State
    const [isProductDetailsModalOpen, setIsProductDetailsModalOpen] = useState(false);
    const [selectedProductDetails, setSelectedProductDetails] = useState(null);
    const [productBatches, setProductBatches] = useState([]);
    const [loadingBatches, setLoadingBatches] = useState(false);

    // Register Batch Modal State
    const [isRegisterBatchModalOpen, setIsRegisterBatchModalOpen] = useState(false);

    // Manage Category Modal State
    const [isManageCategoryModalOpen, setIsManageCategoryModalOpen] = useState(false);

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productForm, setProductForm] = useState({
        name: '',
        barcode: '',
        price: '',
        category_id: 1,
        quantity: '',
        cost: '',
        expiry: ''
    });

    // Restock Modal State
    const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [restockForm, setRestockForm] = useState({
        quantity: '',
        cost: '',
        selling_price: '',
        expiry: ''
    });

    const [categories, setCategories] = useState([]);

    useEffect(() => {
        fetchInventory();
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const apiBase = getApiBase();
            let data = [];
            if (apiBase) {
                const response = await fetch(`${apiBase}/get_categories.php`);
                data = await response.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.getCategories();
            }
            if (Array.isArray(data)) setCategories(data);
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const fetchInventory = async () => {
        try {
            const apiBase = getApiBase();
            let data = [];

            if (apiBase) {
                const response = await fetch(`${apiBase}/products.php`);
                data = await response.json();
            } else if (window.electronAPI) {
                data = await window.electronAPI.getProducts();
            }

            if (Array.isArray(data)) {
                setProducts(data);
            } else {
                setProducts([]);
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddStock = (product) => {
        setSelectedProduct(product);
        setRestockForm({
            quantity: '',
            cost: '0',
            expiry: new Date().toISOString().split('T')[0] // Default today
        });
        setIsRestockModalOpen(true);
    };

    const handleSubmitStock = async (e) => {
        e.preventDefault();
        const { quantity, cost, expiry } = restockForm;

        // Validation: Check Expiry Date
        if (expiry) {
            const today = new Date().toISOString().split('T')[0];
            if (expiry < today) {
                alert("Expiry date cannot be in the past.");
                return;
            }
        }

        if (quantity && selectedProduct) {
            try {
                const apiBase = getApiBase();
                let result;

                const payload = {
                    product_id: selectedProduct.Product_ID,
                    quantity: parseInt(quantity),
                    cost: parseFloat(cost),
                    expiry: expiry,
                    employee_id: user?.employee_id || 1 // Use dynamic ID or fallback
                };

                if (apiBase) {
                    const res = await fetch(`${apiBase}/inventory.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    result = await res.json();
                } else if (window.electronAPI) {
                    result = await window.electronAPI.addStock(payload);
                }

                if (result.status === 'success') {
                    alert('Stock Added Successfully!');
                    setIsRestockModalOpen(false);
                    setIsRegisterBatchModalOpen(false);
                    fetchInventory();
                } else {
                    alert('Failed: ' + result.message);
                }
            } catch (err) {
                console.error(err);
                alert("Error adding stock");
            }
        }
    };

    const fetchBatches = async (productId) => {
        setLoadingBatches(true);
        try {
            const apiBase = getApiBase();
            if (apiBase) {
                const response = await fetch(`${apiBase}/get_batches.php?product_id=${productId}`);
                const result = await response.json();
                if (result.status === 'success') {
                    setProductBatches(result.data);
                } else {
                    setProductBatches([]);
                }
            } else if (window.electronAPI) {
                // Not covered yet, fallback
                setProductBatches([]);
            }
        } catch (error) {
            console.error("Error fetching batches:", error);
            setProductBatches([]);
        } finally {
            setLoadingBatches(false);
        }
    };

    const openProductDetails = (product) => {
        setSelectedProductDetails(product);
        setIsProductDetailsModalOpen(true);
        fetchBatches(product.Product_ID);
    };

    const openAddProductModal = () => {
        setProductForm({
            name: '',
            barcode: '',
            price: '',
            category_id: 1,
            quantity: '',
            cost: '',
            expiry: ''
        });
        setIsProductModalOpen(true);
    };

    const generateBarcode = () => {
        // Auto-generate: 10 chars, Random Prefix (6) + Sequence (4)
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let prefix = "";
        for (let i = 0; i < 6; i++) {
            prefix += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        let maxSeq = 0;
        products.forEach(p => {
            if (p.Barcode && p.Barcode.length === 10) {
                const last4 = p.Barcode.substring(6);
                if (/^\d{4}$/.test(last4)) {
                    const seqNum = parseInt(last4, 10);
                    if (seqNum > maxSeq) maxSeq = seqNum;
                }
            }
        });

        const nextSeq = (maxSeq + 1).toString().padStart(4, '0');
        setProductForm(prev => ({ ...prev, barcode: prefix + nextSeq }));
    };

    const handleSaveProduct = async (e) => {
        e.preventDefault();
        const { name, barcode, price, category_id, quantity, cost, expiry } = productForm;

        // Validation: Required Fields
        if (!name || !price) {
            alert("Product Name and Selling Price are required.");
            return;
        }

        // Validation: Stock Details Required if Quantity > 0
        // User requested: "dont make it optional make it required fields"
        // Interpreting this as: If adding a product, you MUST specify stock details now.
        if (!quantity || !cost || !expiry) {
            alert("Initial Stock (Quantity, Cost, Expiry) is required.");
            return;
        }

        // Validation: Check Expiry Date
        const today = new Date().toISOString().split('T')[0];
        if (expiry < today) {
            alert("Expiry date cannot be in the past.");
            return;
        }

        // Validation: Cost > SRP Warning
        if (parseFloat(cost) > parseFloat(price)) {
            if (!confirm(`Warning: The Cost Price (₱${cost}) is higher than the Selling Price (₱${price}).\n\nAre you sure you want to proceed?`)) {
                return;
            }
        }

        let finalBarcode = barcode;
        if (!finalBarcode) {
            // Auto generate if empty on submit
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let prefix = "";
            for (let i = 0; i < 6; i++) {
                prefix += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            let maxSeq = 0;
            products.forEach(p => {
                if (p.Barcode && p.Barcode.length === 10) {
                    const last4 = p.Barcode.substring(6);
                    if (/^\d{4}$/.test(last4)) {
                        const seqNum = parseInt(last4, 10);
                        if (seqNum > maxSeq) maxSeq = seqNum;
                    }
                }
            });
            finalBarcode = prefix + (maxSeq + 1).toString().padStart(4, '0');
        }

        try {
            const apiBase = getApiBase();
            let result;

            const payload = {
                name: name,
                barcode: finalBarcode,
                price: parseFloat(price),
                category_id: category_id,
                quantity: parseInt(quantity),
                cost: parseFloat(cost),
                expiry: expiry,
                employee_id: user?.employee_id || 1
            };

            if (apiBase) {
                const res = await fetch(`${apiBase}/products.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                result = await res.json();
            } else if (window.electronAPI) {
                result = await window.electronAPI.addProduct(payload);
            }

            if (result.status === 'success') {
                alert('Product Created!');
                setIsProductModalOpen(false);
                fetchInventory();
            } else {
                alert(result.message);
            }
        } catch (err) {
            console.error("Add Product Error:", err);
            alert("Error creating product: " + err.message);
        }
    };

    const handleSeedData = async () => {
        if (!confirm("Load demo data? This will add test products and stock.")) return;
        setLoading(true);
        const apiBase = getApiBase();

        if (!apiBase && window.electronAPI) {
            alert("Demo data seeding is not currently available in Offline Mode.");
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${apiBase}/seed_data.php`);
            const result = await res.json();
            alert(result.message);
            fetchInventory();
        } catch (err) {
            console.error(err);
            alert("Error seeding data");
        } finally {
            setLoading(false);
        }
    };

    // Summary Stats Calculation
    const stats = {
        lowStock: products.filter(p => parseInt(p.Current_Stock) > 0 && parseInt(p.Current_Stock) < 10).length,
        outOfStock: products.filter(p => parseInt(p.Current_Stock) === 0).length,
        totalItems: products.reduce((acc, p) => acc + parseInt(p.Current_Stock), 0)
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedProducts = [...products].sort((a, b) => {
        const valA = a[sortConfig.key];
        const valB = b[sortConfig.key];

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    const filteredProducts = sortedProducts.filter(product => {
        const matchesSearch = product.Product_Name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.Barcode && product.Barcode.includes(searchTerm));

        let matchesFilter = true;
        if (filterType === 'lowStock') {
            matchesFilter = parseInt(product.Current_Stock) > 0 && parseInt(product.Current_Stock) < 10;
        } else if (filterType === 'outOfStock') {
            matchesFilter = parseInt(product.Current_Stock) === 0;
        }

        return matchesSearch && matchesFilter;
    });

    return (
        <div className="inventory-container fade-in">
            {/* Header */}
            <div className="inventory-header">
                <div>
                    <h2 className="text-gradient">Inventory Management</h2>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div
                    className={`summary-card low-stock ${filterType === 'lowStock' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'lowStock' ? 'all' : 'lowStock')}
                >
                    <div className="card-icon-wrapper yellow">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Low Stock</span>
                        <h3 className="card-value">{stats.lowStock} <span className="unit">Types</span></h3>
                    </div>
                </div>

                <div
                    className={`summary-card out-stock ${filterType === 'outOfStock' ? 'active' : ''}`}
                    onClick={() => setFilterType(filterType === 'outOfStock' ? 'all' : 'outOfStock')}
                >
                    <div className="card-icon-wrapper red">
                        <Archive size={20} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Out of Stock</span>
                        <h3 className="card-value">{stats.outOfStock} <span className="unit">Types</span></h3>
                    </div>
                </div>

                <div
                    className={`summary-card near-expiry ${filterType === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterType('all')}
                >
                    <div className="card-icon-wrapper blue">
                        <Package size={20} />
                    </div>
                    <div className="card-content">
                        <span className="card-label">Total Items</span>
                        <h3 className="card-value">{stats.totalItems} <span className="unit">Units</span></h3>
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="inventory-toolbar">
                <div className="toolbar-left">
                    <div className="search-bar expanded">
                        <Search size={18} className="inventory-search-icon" />
                        <input
                            type="text"
                            placeholder="Search products..."
                            className="search-input"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {user?.role !== 'Cashier' && (
                        <button className="btn-filter" style={{ marginLeft: '12px', background: 'var(--card-bg)' }}>
                            <Filter size={16} /> Category
                        </button>
                    )}
                    <span className="item-count" style={{ marginLeft: '16px' }}><b>{filteredProducts.length}</b> products</span>
                </div>

                <div className="toolbar-right">
                    {user?.role !== 'Cashier' && (
                        <>
                            <button className="btn-filter" onClick={handleSeedData} style={{ marginRight: 8, background: 'transparent' }}>
                                Export
                            </button>
                            <button className="btn-filter" onClick={() => setIsRegisterBatchModalOpen(true)} style={{ marginRight: 8, background: 'var(--glass-surface)', color: 'var(--text-accent)' }}>
                                <Plus size={16} /> Register Batch
                            </button>
                            <button className="btn-add-product" onClick={openAddProductModal}>
                                + Add Product
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Inventory Table */}
            <div className="glass-panel inventory-table-container">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th onClick={() => handleSort('Product_Name')}>Product Name</th>
                            <th onClick={() => handleSort('Category_Name')}>Category</th>
                            <th onClick={() => handleSort('Current_Price')}>Price</th>
                            <th onClick={() => handleSort('Current_Stock')}>Stock (Total)</th>
                            <th onClick={() => handleSort('Barcode')}>Barcode</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>Loading inventory...</td>
                            </tr>
                        ) : filteredProducts.length > 0 ? (
                            filteredProducts.map((product) => (
                                <React.Fragment key={product.Product_ID}>
                                    <tr className="inventory-product-row">
                                        <td>
                                            <span className="product-name">{product.Product_Name}</span>
                                        </td>
                                        <td>{product.Category_Name || 'Uncategorized'}</td>
                                        <td style={{ fontWeight: '600' }}>₱{parseFloat(product.Current_Price).toFixed(2)}</td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                {product.Current_Stock}
                                                {parseInt(product.Expiring_Batches) > 0 && (
                                                    <div title="Has items expiring soon" style={{ color: '#f97316', display: 'flex' }}>
                                                        <AlertCircle size={14} />
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="sku-text">{product.Barcode || '-'}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="btn-action-outline" onClick={() => openProductDetails(product)}>
                                                See details
                                            </button>
                                        </td>
                                    </tr>
                                </React.Fragment>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                        <AlertCircle size={32} opacity={0.5} />
                                        <p>No products found.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Product Modal */}
            {isProductModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card">
                        <button className="close-btn" onClick={() => setIsProductModalOpen(false)}>
                            <X size={20} />
                        </button>
                        <div className="modal-header">
                            <h3>Add New Product</h3>
                        </div>
                        <form className="modal-form" onSubmit={handleSaveProduct}>
                            <div className="field-group">
                                <label>Product Name</label>
                                <input
                                    type="text"
                                    className="modal-input"
                                    value={productForm.name}
                                    onChange={e => setProductForm({ ...productForm, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="field-group">
                                <label>Barcode (SKU)</label>
                                <div className="input-with-action">
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={productForm.barcode}
                                        onChange={e => setProductForm({ ...productForm, barcode: e.target.value })}
                                        placeholder="Leave empty to auto-generate"
                                    />
                                    <button type="button" className="btn-autogen" onClick={generateBarcode}>
                                        Auto-Gen
                                    </button>
                                </div>
                            </div>
                            <div className="field-group">
                                <label>Category</label>
                                <div className="select-wrapper">
                                    <select
                                        className="modal-input"
                                        value={productForm.category_id}
                                        onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={16} className="select-icon" />
                                </div>
                            </div>
                            <div className="field-group">
                                <label>Selling Price (SRP)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="modal-input"
                                    value={productForm.price}
                                    onChange={e => setProductForm({ ...productForm, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="modal-divider"></div>
                            <h4 style={{ margin: '16px 0 12px', color: 'var(--text-primary)' }}>Initial Stock (Optional)</h4>

                            <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                                <div className="field-group">
                                    <label>Quantity</label>
                                    <input
                                        type="number"
                                        className="modal-input"
                                        value={productForm.quantity}
                                        onChange={e => setProductForm({ ...productForm, quantity: e.target.value })}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="field-group">
                                    <label>Cost</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="modal-input"
                                        value={productForm.cost}
                                        onChange={e => setProductForm({ ...productForm, cost: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="field-group">
                                    <label>Expiry</label>
                                    <input
                                        type="date"
                                        className="modal-input"
                                        value={productForm.expiry}
                                        onChange={e => setProductForm({ ...productForm, expiry: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '20px' }}>
                                <button type="button" className="cancel-btn" onClick={() => setIsProductModalOpen(false)}>Cancel</button>
                                <button type="submit" className="submit-btn">Save Product</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Register Batch Modal */}
            {isRegisterBatchModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '700px' }}>
                        <button className="close-btn" onClick={() => { setIsRegisterBatchModalOpen(false); setSelectedProduct(null); }}>
                            <X size={20} />
                        </button>
                        <div className="modal-header">
                            <h3 style={{ color: 'var(--text-primary)', marginBottom: 0, fontSize: '20px' }}>Register Batch Product</h3>
                        </div>
                        <form className="modal-form" onSubmit={handleSubmitStock} style={{ marginTop: '24px' }}>

                            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Product Information</h4>
                            <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="field-group">
                                    <label>Product ID</label>
                                    <div className="select-wrapper">
                                        <select
                                            className="modal-input"
                                            value={selectedProduct ? selectedProduct.Product_ID : ''}
                                            onChange={(e) => {
                                                const prod = products.find(p => p.Product_ID.toString() === e.target.value);
                                                setSelectedProduct(prod || null);
                                                if (prod) {
                                                    setRestockForm(prev => ({ ...prev, selling_price: prod.Current_Price || '' }));
                                                } else {
                                                    setRestockForm(prev => ({ ...prev, selling_price: '' }));
                                                }
                                            }}
                                            required
                                        >
                                            <option value="">select product</option>
                                            {products.map(p => (
                                                <option key={p.Product_ID} value={p.Product_ID}>{p.Barcode || p.Product_ID}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={16} className="select-icon" />
                                    </div>
                                </div>
                                <div className="field-group">
                                    <label>Product name</label>
                                    <input
                                        type="text"
                                        className="modal-input"
                                        value={selectedProduct ? selectedProduct.Product_Name : ''}
                                        readOnly
                                        disabled
                                        style={{ opacity: 0.7 }}
                                    />
                                </div>
                            </div>

                            <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Batch Details</h4>
                            <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                <div className="field-group" style={{ gridColumn: 'span 1' }}>
                                    <label>Batch ID</label>
                                    <input
                                        type="text"
                                        className="modal-input"
                                        placeholder="Auto-generated"
                                        readOnly
                                        disabled
                                        style={{ opacity: 0.7 }}
                                    />
                                </div>
                                <div className="field-group">
                                    <label>Received Date</label>
                                    <input
                                        type="date"
                                        className="modal-input"
                                        value={new Date().toISOString().split('T')[0]}
                                        readOnly
                                        disabled
                                        style={{ opacity: 0.7 }}
                                    />
                                </div>
                                <div className="field-group">
                                    <label>Expiry Date</label>
                                    <input
                                        type="date"
                                        className="modal-input"
                                        value={restockForm.expiry}
                                        onChange={e => setRestockForm({ ...restockForm, expiry: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                                <div>
                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Pricing</h4>
                                    <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                                        <div className="field-group">
                                            <label>Cost Price</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className="modal-input"
                                                value={restockForm.cost}
                                                onChange={e => setRestockForm({ ...restockForm, cost: e.target.value.replace(/[^0-9.]/g, '') })}
                                                required
                                            />
                                        </div>
                                        <div className="field-group">
                                            <label>Selling Price</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                className="modal-input"
                                                value={restockForm.selling_price}
                                                onChange={e => setRestockForm({ ...restockForm, selling_price: e.target.value.replace(/[^0-9.]/g, '') })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Quantity</h4>
                                    <div className="input-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                                        <div className="field-group">
                                            <label>Quantity</label>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="modal-input"
                                                value={restockForm.quantity}
                                                onChange={e => setRestockForm({ ...restockForm, quantity: e.target.value.replace(/\D/g, '') })}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-actions" style={{ marginTop: '8px', borderTop: 'none', paddingTop: 0 }}>
                                <button type="button" className="cancel-btn" style={{ border: '1px solid var(--glass-border)', padding: '10px 24px', borderRadius: '12px' }} onClick={() => { setIsRegisterBatchModalOpen(false); setSelectedProduct(null); }}>Discard</button>
                                <button type="submit" className="submit-btn" style={{ padding: '10px 24px', borderRadius: '12px' }}>Register Batch</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Product Details Modal */}
            {isProductDetailsModalOpen && selectedProductDetails && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '800px' }}>
                        <button className="close-btn" onClick={() => setIsProductDetailsModalOpen(false)}>
                            <X size={20} />
                        </button>
                        <div className="modal-header">
                            <h3 style={{ color: 'var(--text-primary)', marginBottom: 0, fontSize: '20px' }}>Product Details - {selectedProductDetails.Product_Name}</h3>
                        </div>
                        <div className="product-details-content" style={{ display: 'flex', gap: '32px', marginTop: '24px' }}>
                            <div className="details-left" style={{ flex: '1', minWidth: '250px' }}>
                                <div style={{ marginBottom: '24px' }}>
                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Product Information</h4>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Product ID:</span>
                                        <span style={{ fontWeight: '600' }}>{selectedProductDetails.Barcode || selectedProductDetails.Product_ID}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Product name:</span>
                                        <span style={{ fontWeight: '600' }}>{selectedProductDetails.Product_Name}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
                                        <span style={{ fontWeight: '600' }}>{selectedProductDetails.Category_Name || 'Uncategorized'}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <span style={{ color: 'var(--text-secondary)' }}>Current price:</span>
                                        <span style={{ fontWeight: '600' }}>₱{parseFloat(selectedProductDetails.Current_Price).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Current Batch</h4>
                                    {productBatches.length > 0 ? (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Batch ID:</span>
                                                <span style={{ fontWeight: '600' }}>B{productBatches[0].Batch_ID.toString().padStart(3, '0')}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Expiry:</span>
                                                <span style={{ fontWeight: '600' }}>{productBatches[0].Expiry_Date ? new Date(productBatches[0].Expiry_Date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Remaining:</span>
                                                <span style={{ fontWeight: '600' }}>{productBatches[0].Quantity_On_Hand} units</span>
                                            </div>
                                        </>
                                    ) : (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No active batches.</p>
                                    )}
                                </div>
                            </div>

                            <div className="details-right" style={{ flex: '2', borderLeft: '1px solid var(--glass-border)', paddingLeft: '32px' }}>
                                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Batch List</h4>
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="batch-list-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Batch</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Expiry</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Received</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Quantity</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Cost</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Selling</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loadingBatches ? (
                                                <tr><td colSpan="6" style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>Loading...</td></tr>
                                            ) : productBatches.length > 0 ? (
                                                productBatches.map(batch => (
                                                    <tr key={batch.Batch_ID}>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>B{batch.Batch_ID.toString().padStart(3, '0')}</td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>{batch.Expiry_Date ? new Date(batch.Expiry_Date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'N/A'}</td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>{new Date(batch.Received_Date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>{batch.Quantity_On_Hand}</td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>₱{parseFloat(batch.Cost_Price).toFixed(2)}</td>
                                                        <td style={{ padding: '12px 0', borderBottom: '1px solid var(--glass-border)' }}>₱{parseFloat(selectedProductDetails.Current_Price).toFixed(2)}</td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr><td colSpan="6" style={{ padding: '16px 0', color: 'var(--text-secondary)' }}>No active batches found.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Manage Category Modal */}
            {false && isManageCategoryModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-card" style={{ maxWidth: '800px' }}>
                        <button className="close-btn" onClick={() => setIsManageCategoryModalOpen(false)}>
                            <X size={20} />
                        </button>
                        <div className="modal-header">
                            <h3 style={{ color: 'var(--text-primary)', marginBottom: 0, fontSize: '20px' }}>Manage Category</h3>
                        </div>
                        <div className="category-details-content" style={{ display: 'flex', gap: '32px', marginTop: '24px' }}>
                            <div className="details-left" style={{ flex: '1', minWidth: '250px' }}>
                                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '16px', letterSpacing: '0.5px' }}>Edit Category</h4>
                                <div className="field-group" style={{ marginBottom: '16px' }}>
                                    <label>Category name</label>
                                    <input type="text" className="modal-input" placeholder="e.g. Packaged Goods" />
                                </div>
                                <div className="field-group" style={{ marginBottom: '24px' }}>
                                    <label>Description</label>
                                    <textarea className="modal-input" rows="4" placeholder="Description..."></textarea>
                                </div>
                                <div className="modal-actions" style={{ padding: 0, border: 'none', display: 'flex', gap: '12px' }}>
                                    <button type="button" className="cancel-btn" style={{ flex: '1', padding: '10px 0', borderRadius: '12px', border: '1px solid var(--glass-border)' }} onClick={() => setIsManageCategoryModalOpen(false)}>Discard</button>
                                    <button type="button" className="submit-btn" style={{ flex: '1', padding: '10px 0', borderRadius: '12px' }}>Save</button>
                                </div>
                            </div>

                            <div className="details-right" style={{ flex: '2', borderLeft: '1px solid var(--glass-border)', paddingLeft: '32px' }}>
                                <h4 style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '12px', letterSpacing: '0.5px' }}>Category List</h4>
                                <div style={{ overflowX: 'auto', maxHeight: '300px', paddingRight: '12px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Name</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Description</th>
                                                <th style={{ textAlign: 'left', paddingBottom: '12px', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase', borderBottom: '1px solid var(--glass-border)' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {categories.map(cat => (
                                                <tr key={cat.id}>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', fontWeight: '500' }}>{cat.name}</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>{cat.description || 'No description'}</td>
                                                    <td style={{ padding: '16px 0', borderBottom: '1px solid var(--glass-border)' }}>
                                                        <button className="btn-action edit" style={{ borderRadius: '50px', padding: '6px 16px', background: 'rgba(163, 230, 53, 0.2)', color: '#65a30d', border: '1px solid rgba(163, 230, 53, 0.3)' }}>
                                                            <Edit size={14} style={{ marginRight: '4px' }} /> Edit
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default Inventory;
