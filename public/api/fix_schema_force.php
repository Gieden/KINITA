<?php
require 'db_connect.php';

try {
    // 1. Drop Column if exists
    // We can't use IF EXISTS in older MariaDB/MySQL easily in ALTER TABLE sometimes, but let's try
    // Or just run it and catch error
    $conn->query("ALTER TABLE ACCOUNT DROP COLUMN Face_Descriptor");
    echo "Dropped Face_Descriptor (if it existed).\n";
} catch (Exception $e) {
    echo "Drop failed (maybe didn't exist): " . $e->getMessage() . "\n";
}

try {
    // 2. Add Column
    $sql = "ALTER TABLE ACCOUNT ADD COLUMN Face_Descriptor TEXT DEFAULT NULL";
    if ($conn->query($sql)) {
        echo "Face_Descriptor ADDED SUCCESSFULLY.\n";
    } else {
        throw new Exception("Error adding column: " . $conn->error);
    }
    
    // 3. Verify
    $check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Face_Descriptor'");
    if ($check->num_rows > 0) {
        echo "VERIFICATION: Face_Descriptor FOUND in schema.\n";
    } else {
        echo "VERIFICATION FAILED: Face_Descriptor NOT FOUND.\n";
    }
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
?>
