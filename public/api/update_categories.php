<?php
require 'db_connect.php';
header('Content-Type: application/json');

try {
    $conn->begin_transaction();

    // 1. Clear existing Mapping (Set category_id to NULL for existing products)
    $conn->query("UPDATE products SET category_id = NULL");

    // 2. Truncate categories table to reset IDs
    // Cannot TRUNCATE if referenced by FK, so we need to disable checks or just DELETE
    $conn->query("SET FOREIGN_KEY_CHECKS = 0");
    $conn->query("TRUNCATE TABLE categories");
    $conn->query("SET FOREIGN_KEY_CHECKS = 1");

    // 3. Insert New Categories
    $categories = [
        ['name' => 'Uncategorized', 'desc' => 'Default Category'],
        ['name' => 'Staple Foods', 'desc' => 'Rice, pasta, bread, etc.'],
        ['name' => 'Packaged Goods', 'desc' => 'Canned goods, noodles, etc.'],
        ['name' => 'Snacks', 'desc' => 'Chips, biscuits, candies'],
        ['name' => 'Beverages', 'desc' => 'Soft drinks, juices, water'],
        ['name' => 'Personal Care', 'desc' => 'Shampoo, soap, toothpaste'],
        ['name' => 'Cleaning supplies', 'desc' => 'Detergent, bleach, etc.']
    ];

    foreach ($categories as $cat) {
        $name = $cat['name'];
        $desc = $cat['desc'];
        $conn->query("INSERT INTO categories (name, description) VALUES ('$name', '$desc')");
    }

    // 4. Update Products (Simple matching by name or logic if needed, but for now just committing)
    // This script seems to just reset categories.
    
    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Categories updated successfully."]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
