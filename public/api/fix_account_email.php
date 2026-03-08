<?php
require 'db_connect.php';

header('Content-Type: application/json');

try {
    // Check if Email column exists
    $check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Email'");
    
    if ($check->num_rows == 0) {
        // Add Email Column
        $sql = "ALTER TABLE ACCOUNT ADD COLUMN Email VARCHAR(100) UNIQUE AFTER Last_Name";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "message" => "Added Email column to ACCOUNT table."]);
        } else {
            throw new Exception("Error adding column: " . $conn->error);
        }
    } else {
        echo json_encode(["status" => "success", "message" => "Email column already exists."]);
    }

} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
