<?php
// update_schema_face.php
require 'db_connect.php';

try {
    // Check if column exists
    $check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Face_Descriptor'");
    
    if ($check->num_rows == 0) {
        // Add column
        $sql = "ALTER TABLE ACCOUNT ADD COLUMN Face_Descriptor TEXT DEFAULT NULL";
        if ($conn->query($sql)) {
            echo json_encode(["status" => "success", "message" => "Column Face_Descriptor added successfully."]);
        } else {
            throw new Exception("Error adding column: " . $conn->error);
        }
    } else {
        echo json_encode(["status" => "success", "message" => "Column Face_Descriptor already exists."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
