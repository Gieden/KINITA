<?php
require_once 'db_connect.php';

// List of categories to add
$categories = [
    'Staple Foods',
    'Packaged Goods',
    'Snacks',
    'Beverages',
    'Personal Care',
    'Cleaning Supplies'
];

$conn->begin_transaction();

try {
    echo "Starting category seeding...\n";
    
    foreach ($categories as $categoryName) {
        // Check if exists
        $stmt = $conn->prepare("SELECT id FROM categories WHERE name = ?");
        $stmt->bind_param("s", $categoryName);
        $stmt->execute();
        $result = $stmt->get_result();

        if ($result->num_rows == 0) {
            $stmtInsert = $conn->prepare("INSERT INTO categories (name, description) VALUES (?, 'General Description')");
            $stmtInsert->bind_param("s", $categoryName);
            if ($stmtInsert->execute()) {
                echo " [ADDED] $categoryName\n";
            } else {
                 echo " [ERROR] Could not add $categoryName: " . $conn->error . "\n";
            }
        } else {
            echo " [EXISTS] $categoryName\n";
        }
    }

    echo "\nSuccess: Category seeding completed.\n";
} catch (Exception $e) {
    $conn->rollback();
    echo "\nError: " . $e->getMessage() . "\n";
}

$conn->close();
?>
