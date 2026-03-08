<?php
require 'db_connect.php';

header('Content-Type: application/json');

$response = [];

try {
    // 1. Add Middle_Name if missing
    $check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Middle_Name'");
    if ($check->num_rows == 0) {
        $sql = "ALTER TABLE ACCOUNT ADD COLUMN Middle_Name VARCHAR(100) AFTER First_Name";
        if ($conn->query($sql)) {
            $response[] = "Added Middle_Name column.";
        } else {
            throw new Exception("Error adding Middle_Name: " . $conn->error);
        }
    } else {
        $response[] = "Middle_Name already exists.";
    }

    // 2. Change Employee_Role to VARCHAR(50)
    // We run this unconditionally to ensure it's not ENUM
    $sqlRole = "ALTER TABLE EMPLOYEE MODIFY COLUMN Employee_Role VARCHAR(50) NOT NULL";
    if ($conn->query($sqlRole)) {
        $response[] = "Ensured Employee_Role is VARCHAR(50).";
    } else {
        throw new Exception("Error modifying Employee_Role: " . $conn->error);
    }

    // 3. Fix data: Update empty roles to 'Owner'
    $updateSql = "UPDATE EMPLOYEE SET Employee_Role = 'Owner' WHERE Employee_Role = '' OR Employee_Role IS NULL";
    $conn->query($updateSql);
    if ($conn->affected_rows > 0) {
        $response[] = "Updated " . $conn->affected_rows . " empty roles to 'Owner'.";
    }

    echo json_encode(["status" => "success", "actions" => $response]);

} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
