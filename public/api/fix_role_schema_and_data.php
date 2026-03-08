<?php
require 'db_connect.php';

header('Content-Type: application/json');

try {
    // 1. Change Employee_Role to VARCHAR(50)
    $sql = "ALTER TABLE EMPLOYEE MODIFY COLUMN Employee_Role VARCHAR(50) NOT NULL";
    if ($conn->query($sql)) {
        echo "Successfully changed Employee_Role to VARCHAR(50).\n";
    } else {
        throw new Exception("Error altering table: " . $conn->error);
    }

    // 2. Update empty roles to 'Owner'
    // We assume any employee without a role right now is the intended Owner who failed registration
    $updateSql = "UPDATE EMPLOYEE SET Employee_Role = 'Owner' WHERE Employee_Role = '' OR Employee_Role IS NULL";
    if ($conn->query($updateSql)) {
        echo "Successfully updated " . $conn->affected_rows . " employee roles to 'Owner'.\n";
    } else {
        throw new Exception("Error updating roles: " . $conn->error);
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

$conn->close();
?>
