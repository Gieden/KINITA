-- Database: kinita_db
CREATE DATABASE IF NOT EXISTS kinita_db;
USE kinita_db;

-- Table: ACCOUNT
CREATE TABLE IF NOT EXISTS ACCOUNT (
    Account_ID INT AUTO_INCREMENT PRIMARY KEY,
    Username VARCHAR(50) NOT NULL UNIQUE,
    Password VARCHAR(255) NOT NULL,
    First_Name VARCHAR(100) NOT NULL,
    Last_Name VARCHAR(100) NOT NULL,
    Email VARCHAR(100),
    Contact_Number VARCHAR(20),
    Face_Descriptor TEXT, -- Added for Face Recognition
    Created_At TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: EMPLOYEE
CREATE TABLE IF NOT EXISTS EMPLOYEE (
    Employee_ID INT AUTO_INCREMENT PRIMARY KEY,
    Account_ID INT NOT NULL,
    Employee_Role ENUM('Owner', 'Admin', 'Cashier', 'Manager') NOT NULL,
    FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID) ON DELETE CASCADE
);

-- Table: CATEGORY
CREATE TABLE IF NOT EXISTS CATEGORY (
    Category_ID INT AUTO_INCREMENT PRIMARY KEY,
    Category_Name VARCHAR(100) NOT NULL UNIQUE,
    Category_Description TEXT
);

-- Table: PRODUCT
CREATE TABLE IF NOT EXISTS PRODUCT (
    Product_ID INT AUTO_INCREMENT PRIMARY KEY,
    Category_ID INT,
    Barcode VARCHAR(100) UNIQUE,
    Product_Name VARCHAR(100) NOT NULL,
    Current_Price DECIMAL(10,2) DEFAULT 0.00,
    FOREIGN KEY (Category_ID) REFERENCES CATEGORY(Category_ID) ON DELETE SET NULL
);

-- Table: INVENTORY (One-to-One with Product)
CREATE TABLE IF NOT EXISTS INVENTORY (
    Product_ID INT PRIMARY KEY,
    Current_Stock INT DEFAULT 0,
    Last_Updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID) ON DELETE CASCADE
);

-- Table: INVENTORY_BATCH (For tracking expiration and batches)
CREATE TABLE IF NOT EXISTS INVENTORY_BATCH (
    Batch_ID INT AUTO_INCREMENT PRIMARY KEY,
    Product_ID INT NOT NULL,
    Quantity_On_Hand INT NOT NULL,
    Expiry_Date DATE,
    Cost_Price DECIMAL(10,2),
    Received_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID) ON DELETE CASCADE
);

-- Table: PRICE_HISTORY
CREATE TABLE IF NOT EXISTS PRICE_HISTORY (
    Price_ID INT AUTO_INCREMENT PRIMARY KEY,
    Product_ID INT NOT NULL,
    Employee_ID INT,
    Old_Price DECIMAL(10,2),
    New_Price DECIMAL(10,2),
    Price_Change_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID),
    FOREIGN KEY (Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
);

-- Table: SALE_TRANSACTION
CREATE TABLE IF NOT EXISTS SALE_TRANSACTION (
    SaleTransaction_ID INT AUTO_INCREMENT PRIMARY KEY,
    Cashier_Employee_ID INT,
    Transaction_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    Amount_Total DECIMAL(10,2) NOT NULL,
    Amount_Tendered DECIMAL(10,2),
    Amount_Change DECIMAL(10,2),
    FOREIGN KEY (Cashier_Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
);

-- Table: SALE_TRANSACTION_DETAIL
CREATE TABLE IF NOT EXISTS SALE_TRANSACTION_DETAIL (
    Sale_Detail_ID INT AUTO_INCREMENT PRIMARY KEY,
    Sale_Transaction_ID INT NOT NULL,
    Product_ID INT NOT NULL,
    Sold_Quantity INT NOT NULL,
    Sold_Price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (Sale_Transaction_ID) REFERENCES SALE_TRANSACTION(SaleTransaction_ID) ON DELETE CASCADE,
    FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID)
);

-- Table: STOCK_MOVEMENT
CREATE TABLE IF NOT EXISTS STOCK_MOVEMENT (
    Movement_ID INT AUTO_INCREMENT PRIMARY KEY,
    Product_ID INT NOT NULL,
    Batch_ID INT,
    Sale_Detail_ID INT,
    Employee_ID INT,
    Movement_Type ENUM('Sale', 'Restock', 'Adjustment', 'Return', 'Expiry') NOT NULL,
    Quantity_Change INT NOT NULL,
    Movement_Date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (Product_ID) REFERENCES PRODUCT(Product_ID),
    FOREIGN KEY (Batch_ID) REFERENCES INVENTORY_BATCH(Batch_ID),
    FOREIGN KEY (Sale_Detail_ID) REFERENCES SALE_TRANSACTION_DETAIL(Sale_Detail_ID),
    FOREIGN KEY (Employee_ID) REFERENCES EMPLOYEE(Employee_ID)
);

-- Store Config
CREATE TABLE IF NOT EXISTS store_config (
    id INT PRIMARY KEY DEFAULT 1,
    store_name VARCHAR(255) DEFAULT 'Kinita POS',
    is_sealed TINYINT(1) DEFAULT 0,
    CONSTRAINT single_row CHECK(id = 1)
);

-- Default Config
INSERT INTO store_config (id, store_name, is_sealed) VALUES (1, 'Kinita POS', 0) ON DUPLICATE KEY UPDATE id=1;

-- Seed Default Categories
INSERT IGNORE INTO CATEGORY (Category_Name, Category_Description) VALUES 
('Uncategorized', 'Default Category'),
('Staple Foods', 'Rice, pasta, bread, etc.'),
('Packaged Goods', 'Canned goods, noodles, etc.'),
('Snacks', 'Chips, biscuits, candies'),
('Beverages', 'Soft drinks, juices, water'),
('Personal Care', 'Shampoo, soap, toothpaste'),
('Cleaning Supplies', 'Detergent, bleach, etc.');


