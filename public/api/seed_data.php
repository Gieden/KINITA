<?php
require_once 'db_connect.php';

// Prepare data
// Prepare data
$categories = [
    ['Staple Foods', 'Rice, Bread, Eggs, etc.'],
    ['Packaged Goods', 'Canned food, Instant Noodles, etc.'],
    ['Snacks', 'Chips, Biscuits, Candies'],
    ['Beverages', 'Soft drinks, Water, Juices'],
    ['Personal Care', 'Hygiene products, Soaps, Shampoos'],
    ['Cleaning Supplies', 'Detergents, Bleach, Cleaning tools']
];

$products = [
    ['Coke Can', 'RNDM010001', 35.00, 'Beverages'],
    ['Pepsi Can', 'RNDM010002', 35.00, 'Beverages'],
    ['Nature Spring Water', 'RNDM020003', 15.00, 'Beverages'],
    ['Piattos Cheese', 'SNACK10004', 45.00, 'Snacks'],
    ['Nova Multigrain', 'SNACK10005', 42.00, 'Snacks'],
    ['Century Tuna', 'CAN0010006', 55.00, 'Packaged Goods'],
    ['Corned Beef', 'CAN0010007', 65.00, 'Packaged Goods'],
    ['Safeguard Soap', 'SOAP010008', 30.00, 'Personal Care'],
    ['Surf Powder', 'CLEAN001', 12.00, 'Cleaning Supplies'],
    ['Sinandomeng Rice 1kg', 'RICE001', 52.00, 'Staple Foods']
];

$conn->begin_transaction();

try {
    // 1. Insert Categories
    foreach ($categories as $cat) {
        $name = $cat[0];
        $desc = $cat[1];
        // Check if exists
        $check = $conn->query("SELECT Category_ID FROM CATEGORY WHERE Category_Name = '$name'");
        if ($check->num_rows == 0) {
            $conn->query("INSERT INTO CATEGORY (Category_Name, Category_Description) VALUES ('$name', '$desc')");
        }
    }

    // 2. Insert Products & Initial Batches
    foreach ($products as $prod) {
        $name = $prod[0];
        $barcode = $prod[1];
        $price = $prod[2];
        $catName = $prod[3];

        // Get Category ID
        $resCat = $conn->query("SELECT Category_ID FROM CATEGORY WHERE Category_Name = '$catName'");
        $catId = $resCat->fetch_assoc()['Category_ID'];

        // Check if product exists
        $checkProd = $conn->query("SELECT Product_ID FROM PRODUCT WHERE Barcode = '$barcode'");
        
        if ($checkProd->num_rows == 0) {
            $conn->query("INSERT INTO PRODUCT (Product_Name, Barcode, Current_Price, Category_ID) VALUES ('$name', '$barcode', $price, $catId)");
            $prodId = $conn->insert_id;
            
            // Create Inventory Entry
            $conn->query("INSERT INTO INVENTORY (Product_ID, Current_Stock) VALUES ($prodId, 0)");

            // Create Initial Batch (Seeding 50 units each)
            $qty = 50;
            $cost = $price * 0.7; // 30% margin assumption
            $expiry = date('Y-m-d', strtotime('+6 months'));
            
            $conn->query("INSERT INTO INVENTORY_BATCH (Product_ID, Quantity_On_Hand, Expiry_Date, Cost_Price) VALUES ($prodId, $qty, '$expiry', $cost)");
            $batchId = $conn->insert_id;

            // Update Inventory
            $conn->query("UPDATE INVENTORY SET Current_Stock = $qty WHERE Product_ID = $prodId");

            // Log Movement
            // Employee 1 assumed to be Owner/Admin
            $conn->query("INSERT INTO STOCK_MOVEMENT (Product_ID, Batch_ID, Employee_ID, Movement_Type, Quantity_Change) 
                          VALUES ($prodId, $batchId, 1, 'Restock', $qty)"); 
        }
    }

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Demo data seeded successfully!"]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
