const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

// Initialize Database
let db;
try {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'kinita.db');
    db = new Database(dbPath);
    console.log(`Database connected at: ${dbPath}`);

    // Create tables matching setup.sql logic (Complex Schema)
    db.exec(`
    CREATE TABLE IF NOT EXISTS store_config (
        id INTEGER PRIMARY KEY DEFAULT 1,
        store_name TEXT DEFAULT 'Kinita POS',
        is_sealed INTEGER DEFAULT 0,
        CONSTRAINT single_row CHECK(id = 1)
    );

    CREATE TABLE IF NOT EXISTS ACCOUNT (
        Account_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Username TEXT UNIQUE NOT NULL,
        Password TEXT NOT NULL,
        First_Name TEXT NOT NULL,
        Last_Name TEXT NOT NULL,
        Middle_Name TEXT,
        Email TEXT,
        Contact_Number TEXT,
        Face_Descriptor TEXT,
        Created_At DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS EMPLOYEE (
        Employee_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Account_ID INTEGER NOT NULL,
        Employee_Role TEXT NOT NULL, -- Enum simulated as TEXT
        FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS PRODUCT (
        Product_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Barcode TEXT UNIQUE,
        Product_Name TEXT NOT NULL,
        Category TEXT NOT NULL DEFAULT 'Uncategorized',
        Current_Price REAL DEFAULT 0.00,
        Image_Path TEXT,
        Status TEXT DEFAULT 'Active'
    );


    CREATE TABLE IF NOT EXISTS INVENTORY (
        Product_ID INTEGER PRIMARY KEY,
        Current_Stock INTEGER DEFAULT 0,
        Last_Updated DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS INVENTORY_BATCH (
        Batch_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Product_ID INTEGER NOT NULL,
        Quantity_On_Hand INTEGER NOT NULL,
        Expiry_Date TEXT, -- SQLite stores dates as TEXT
        Cost_Price REAL,
        Received_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS PRICE_HISTORY (
        Price_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Product_ID INTEGER NOT NULL,
        Employee_ID INTEGER,
        Old_Price REAL,
        New_Price REAL,
        Price_Change_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID),
        FOREIGN KEY (Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
    );

    CREATE TABLE IF NOT EXISTS SALE_TRANSACTION (
        SaleTransaction_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Cashier_Employee_ID INTEGER,
        Transaction_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        Amount_Total REAL NOT NULL,
        Amount_Tendered REAL,
        Amount_Change REAL,
        Payment_Method TEXT DEFAULT 'Cash',
        FOREIGN KEY (Cashier_Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
    );

    CREATE TABLE IF NOT EXISTS SALE_TRANSACTION_DETAIL (
        Sale_Detail_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Sale_Transaction_ID INTEGER NOT NULL,
        Product_ID INTEGER NOT NULL,
        Sold_Quantity INTEGER NOT NULL,
        Sold_Price REAL NOT NULL,
        FOREIGN KEY (Sale_Transaction_ID) REFERENCES SALE_TRANSACTION(SaleTransaction_ID) ON DELETE CASCADE,
        FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID)
    );

    CREATE TABLE IF NOT EXISTS STOCK_MOVEMENT (
        Movement_ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Product_ID INTEGER NOT NULL,
        Batch_ID INTEGER,
        Sale_Detail_ID INTEGER,
        Employee_ID INTEGER,
        Movement_Type TEXT NOT NULL,
        Quantity_Change INTEGER NOT NULL,
        Movement_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID),
        FOREIGN KEY (Batch_ID) REFERENCES INVENTORY_BATCH(Batch_ID),
        FOREIGN KEY (Sale_Detail_ID) REFERENCES SALE_TRANSACTION_DETAIL(Sale_Detail_ID),
        FOREIGN KEY (Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
    );
    `);

    // Migration: Check for contact_number column
    try {
        const tableInfo = db.prepare("PRAGMA table_info(employees)").all();
        const hasContact = tableInfo.some(col => col.name === 'contact_number');
        if (!hasContact) {
            db.prepare("ALTER TABLE employees ADD COLUMN contact_number TEXT").run();
            console.log("Migrated: Added contact_number to employees table");
        }

        const hasFace = tableInfo.some(col => col.name === 'face_descriptor');
        if (!hasFace) {
            db.prepare("ALTER TABLE employees ADD COLUMN face_descriptor TEXT").run();
            console.log("Migrated: Added face_descriptor to employees table");
        }
    } catch (e) {
        console.error("Migration error:", e);
    }
} catch (err) {
    console.error('Database initialization error:', err);
}

function getIconPath() {
    // In production, assets are in dist. In dev, they are in public.
    const distIcon = path.join(__dirname, 'dist/logo.png');
    const publicIcon = path.join(__dirname, 'public/logo.png');

    if (fs.existsSync(distIcon)) return distIcon;
    if (fs.existsSync(publicIcon)) return publicIcon;
    return undefined;
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
        title: "KINITA POS",
        icon: getIconPath()
    });

    // Enable DevTools via F12 even in production for debugging
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            win.webContents.toggleDevTools();
            event.preventDefault();
        }
    });

    const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--development');
    if (isDev) {
        // Use https module for the secure dev server
        const https = require('https');

        // Allow self-signed certificates for development
        app.commandLine.appendSwitch('ignore-certificate-errors');

        const loadDevServer = () => {
            // Use lines to bypass self-signed cert validation for the request
            const options = {
                hostname: 'localhost',
                port: 5173,
                path: '/',
                method: 'GET',
                rejectUnauthorized: false
            };

            const req = https.request(options, (res) => {
                console.log("Vite server found. Loading URL...");
                win.loadURL('https://localhost:5173');
                win.webContents.openDevTools();
            });

            req.on('error', (e) => {
                console.log("Searching for Vite dev server on port 5173...", e.message);
                setTimeout(loadDevServer, 2000);
            });

            req.setTimeout(1000, () => req.destroy());
            req.end();
        };
        loadDevServer();
    } else {
        win.loadFile(path.join(__dirname, 'dist/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Allow self-signed certificates for development
// This is critical for loading the HTTPS dev server
app.commandLine.appendSwitch('ignore-certificate-errors');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // On certificate error we disable default behaviour (stop loading the page)
    // and we then say "it is all fine - true" to the callback
    event.preventDefault();
    callback(true);
});

// --- IPC Handlers ---

ipcMain.handle('check-seal', async () => {
    try {
        const owner = db.prepare("SELECT id FROM employees WHERE position = 'Owner'").get();
        return {
            status: 'success',
            is_sealed: !!owner,
            has_db: true
        };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('init-db', async () => {
    try {
        db.prepare("INSERT OR IGNORE INTO store_config (id, store_name, is_sealed) VALUES (1, 'Kinita POS', 0)").run();

        // Ensure default categories exist
        const categories = [
            ['Uncategorized', 'Default Category'],
            ['Staple Foods', 'Rice, pasta, bread, etc.'],
            ['Packaged Goods', 'Canned goods, noodles, etc.'],
            ['Snacks', 'Chips, biscuits, candies'],
            ['Beverages', 'Soft drinks, juices, water'],
            ['Personal Care', 'Shampoo, soap, toothpaste'],
            ['Cleaning Supplies', 'Detergent, bleach, etc.']
        ];

        const insertCat = db.prepare("INSERT OR IGNORE INTO CATEGORY (Category_Name, Category_Description) VALUES (?, ?)");
        categories.forEach(cat => insertCat.run(cat[0], cat[1]));
        return {
            status: 'success',
            stages: ["Verifying System Environment...", "Injecting POS Schemas...", "Optimizing Relations...", "Initializing Staff Hooks..."]
        };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('login', async (event, { username, password }) => {
    try {
        const user = db.prepare('SELECT * FROM employees WHERE (username = ? OR email = ?) AND password_hash = ?').get(username, username, password);
        if (user) {
            return {
                status: 'success',
                user: {
                    name: user.full_name,
                    role: user.position,
                    face_descriptor: user.face_descriptor ? JSON.parse(user.face_descriptor) : null
                }
            };
        }
        return { status: 'error', message: 'Invalid credentials' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('register-owner', async (event, data) => {
    try {
        // Adapting to data from AuthenticationGateway using firstName/lastName/username
        // Defaulting storeName and location since they aren't in the new form
        const { username, password, firstName, lastName, email } = data;
        const ownerName = `${firstName} ${lastName} `;
        const storeName = "Kinita Store";
        const location = "Local";
        const securityKey = "123456"; // Default or generate if needed

        db.transaction(() => {
            db.prepare('INSERT OR REPLACE INTO store_config (id, store_name, location, is_sealed) VALUES (1, ?, ?, 1)').run(storeName, location);
            // Use provided username. If email is missing, it can be null or empty.
            db.prepare('INSERT INTO employees (username, password_hash, full_name, position, email, security_key, face_descriptor) VALUES (?, ?, ?, ?, ?, ?, ?)')
                .run(username, password, ownerName, 'Owner', email || null, securityKey, data.faceDescriptor ? JSON.stringify(data.faceDescriptor) : null);
        })();
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('reset-db', async () => {
    try {
        db.transaction(() => {
            db.prepare('DROP TABLE IF EXISTS sales').run();
            db.prepare('DROP TABLE IF EXISTS products').run();
            db.prepare('DROP TABLE IF EXISTS categories').run();
            db.prepare('DROP TABLE IF EXISTS employees').run();
            db.prepare('DROP TABLE IF EXISTS store_config').run();

            db.exec(`
                CREATE TABLE IF NOT EXISTS store_config(id INTEGER PRIMARY KEY DEFAULT 1, store_name TEXT NOT NULL, location TEXT, is_sealed INTEGER DEFAULT 0, initialized_at DATETIME DEFAULT CURRENT_TIMESTAMP, CONSTRAINT single_row CHECK(id = 1));
                CREATE TABLE IF NOT EXISTS employees(id INTEGER PRIMARY KEY AUTOINCREMENT, full_name TEXT NOT NULL, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, position TEXT NOT NULL, email TEXT, security_key TEXT, status TEXT DEFAULT 'Active', face_descriptor TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER, name TEXT NOT NULL, sku TEXT UNIQUE, price REAL DEFAULT 0.0, stock INTEGER DEFAULT 0, image TEXT, status TEXT DEFAULT 'Available', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(category_id) REFERENCES categories(id));
                CREATE TABLE IF NOT EXISTS sales(id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER, total_amount REAL NOT NULL, payment_method TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(employee_id) REFERENCES employees(id));

                INSERT OR IGNORE INTO categories (name, description) VALUES 
                ('Uncategorized', 'Default Category'),
                ('Staple Foods', 'Rice, pasta, bread, etc.'),
                ('Packaged Goods', 'Canned goods, noodles, etc.'),
                ('Snacks', 'Chips, biscuits, candies'),
                ('Beverages', 'Soft drinks, juices, water'),
                ('Personal Care', 'Shampoo, soap, toothpaste'),
                ('Cleaning supplies', 'Detergent, bleach, etc.');
    `);
        })();
        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-staff', async () => {
    try {
        return db.prepare('SELECT id, full_name as name, email, position as role, status, contact_number as contact FROM employees').all();
    } catch (error) {
        return [];
    }
});

ipcMain.handle('get-enrolled-users', async () => {
    try {
        const users = db.prepare('SELECT id, full_name, position, face_descriptor FROM employees WHERE face_descriptor IS NOT NULL').all();
        return users.map(u => ({
            id: u.id,
            name: u.full_name,
            role: u.position,
            face_descriptor: JSON.parse(u.face_descriptor)
        }));
    } catch (error) {
        console.error(error);
        return [];
    }
});

ipcMain.handle('add-staff', async (event, staffData) => {
    try {
        const { name, email, contact, role, username, password, faceDescriptor } = staffData;
        const info = db.prepare('INSERT INTO employees (full_name, email, contact_number, position, username, password_hash, face_descriptor) VALUES (?, ?, ?, ?, ?, ?, ?)')
            .run(name, email, contact, role, username || email, password || '123456', faceDescriptor ? JSON.stringify(faceDescriptor) : null);
        return { status: 'success', id: info.lastInsertRowid };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-products', async () => {
    try {
        const products = db.prepare(`
            SELECT p.id as Product_ID, p.name as Product_Name, p.sku as Barcode,
        p.price as Current_Price, p.stock as Current_Stock,
        c.name as Category_Name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.name ASC
        `).all();
        return products;
    } catch (error) {
        console.error(error);
        return [];
    }
});

ipcMain.handle('add-product', async (event, data) => {
    try {
        // Handle Auto-Category (Default to 1 if not exists)
        let catId = data.category_id || 1;
        const checkCat = db.prepare('SELECT id FROM categories WHERE id = ?').get(catId);
        if (!checkCat) {
            // Create default category if missing
            const info = db.prepare("INSERT OR IGNORE INTO categories (id, name, description) VALUES (1, 'General', 'Default Category')").run();
            catId = 1;
        }

        const stmt = db.prepare('INSERT INTO products (name, sku, price, category_id, stock) VALUES (?, ?, ?, ?, 0)');
        const info = stmt.run(data.name, data.barcode, data.price, catId);
        return { status: 'success', id: info.lastInsertRowid };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('update-staff', async (event, staffData) => {
    try {
        const { id, name, email, contact, role, username, password, faceDescriptor } = staffData;

        // 1. Update Employee Details
        const stmt = db.prepare('UPDATE employees SET full_name = ?, email = ?, contact_number = ?, position = ?, username = ? WHERE id = ?');
        stmt.run(name, email, contact, role, username || email, id);

        // 2. Update Password if provided
        if (password && password !== '••••••') {
            db.prepare('UPDATE employees SET password_hash = ? WHERE id = ?').run(password, id);
        }

        // 3. Update Face Descriptor if provided
        if (faceDescriptor && faceDescriptor.length > 0) {
            db.prepare('UPDATE employees SET face_descriptor = ? WHERE id = ?').run(JSON.stringify(faceDescriptor), id);
        }

        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});


ipcMain.handle('add-stock', async (event, data) => {
    try {
        const { product_id, quantity } = data;
        let change = parseInt(quantity);

        db.transaction(() => {
            // 1. Update Product Stock
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(change, product_id);

            // 2. Add to Inventory Batch (Simple FIFO/Tracking)
            // For simplicity in SQLite mode, we just track the total stock, but we could add a batch table if needed.
            // Since pos.php uses batches, we should ideally have them, but for now we'll match basic stock logic.
        })();

        return { status: 'success' };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('process-transaction', async (event, data) => {
    try {
        const { cashier_id, items, amount_total, amount_tendered, amount_change } = data;

        if (amount_change < 0) {
            return { status: 'error', message: 'Insufficient payment' };
        }

        let transactionId;

        db.transaction(() => {
            // 1. Create Sale Record
            const info = db.prepare("INSERT INTO sales (employee_id, total_amount, payment_method) VALUES (?, ?, 'Cash')")
                .run(cashier_id, amount_total);
            transactionId = info.lastInsertRowid;

            // 2. Process Items
            const insertDetail = db.prepare("INSERT INTO sale_details (sale_id, product_id, quantity, price) VALUES (?, ?, ?, ?)");
            const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
            const checkStock = db.prepare("SELECT stock FROM products WHERE id = ?");

            for (const item of items) {
                const stock = checkStock.get(item.product_id).stock;
                if (stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ID ${item.product_id}`);
                }

                updateStock.run(item.quantity, item.product_id);
                insertDetail.run(transactionId, item.product_id, item.quantity, item.price);
            }
        })();

        return { status: 'success', transaction_id: transactionId };
    } catch (error) {
        return { status: 'error', message: error.message };
    }
});

ipcMain.handle('get-categories', async () => {
    try {
        return db.prepare('SELECT id, name, description FROM categories ORDER BY name ASC').all();
    } catch (error) {
        return [];
    }
});
