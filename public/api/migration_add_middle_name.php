<?php
// migration_add_middle_name.php
require 'db_connect.php';

header('Content-Type: application/json');

try {
    // Check if column exists
    $check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Middle_Name'");
    
    if ($check->num_rows == 0) {
        $sql = "ALTER TABLE ACCOUNT ADD COLUMN Middle_Name VARCHAR(100) AFTER First_Name";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "message" => "Middle_Name column added successfully."]);
        } else {
            throw new Exception("Error adding column: " . $conn->error);
        }
    } else {
        echo json_encode(["status" => "success", "message" => "Middle_Name column already exists."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
