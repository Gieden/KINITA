<?php
// update_schema.php
require 'db_connect.php';

echo "<h2>Schema Update Utility</h2>";

try {
    // Check if column exists
    $checkCol = "SHOW COLUMNS FROM employees LIKE 'avatar_seed'";
    $result = $conn->query($checkCol);

    if ($result->num_rows == 0) {
        // Add the column
        $sql = "ALTER TABLE employees ADD COLUMN avatar_seed VARCHAR(100) DEFAULT NULL AFTER position";
        if ($conn->query($sql)) {
            echo "<p style='color: green;'>✅ Successfully added 'avatar_seed' column to 'employees' table.</p>";
        } else {
            throw new Exception("Error adding column: " . $conn->error);
        }
    } else {
        echo "<p style='color: blue;'>ℹ️ Column 'avatar_seed' already exists.</p>";
    }

    // Check for profile_picture column
    $checkProfile = "SHOW COLUMNS FROM employees LIKE 'profile_picture'";
    $resultProfile = $conn->query($checkProfile);

    if ($resultProfile->num_rows == 0) {
        $sqlProfile = "ALTER TABLE employees ADD COLUMN profile_picture VARCHAR(255) DEFAULT NULL AFTER avatar_seed";
        if ($conn->query($sqlProfile)) {
            echo "<p style='color: green;'>✅ Successfully added 'profile_picture' column to 'employees' table.</p>";
        } else {
            throw new Exception("Error adding profile_picture column: " . $conn->error);
        }
    } else {
        echo "<p style='color: blue;'>ℹ️ Column 'profile_picture' already exists.</p>";
    }

    // Check for expiry_date column in products
    $checkExpiry = "SHOW COLUMNS FROM products LIKE 'expiry_date'";
    $resultExpiry = $conn->query($checkExpiry);

    if ($resultExpiry->num_rows == 0) {
        $sqlExpiry = "ALTER TABLE products ADD COLUMN expiry_date DATE DEFAULT NULL AFTER status";
        if ($conn->query($sqlExpiry)) {
            echo "<p style='color: green;'>✅ Successfully added 'expiry_date' column to 'products' table.</p>";
        } else {
            throw new Exception("Error adding expiry_date column: " . $conn->error);
        }
    } else {
        echo "<p style='color: blue;'>ℹ️ Column 'expiry_date' already exists.</p>";
    }

} catch (Exception $e) {
    echo "<p style='color: red;'>❌ Error: " . $e->getMessage() . "</p>";
}

$conn->close();
?>
