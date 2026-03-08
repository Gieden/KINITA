<?php
// delete_staff.php
require 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['id'])) {
    die(json_encode(["status" => "error", "message" => "Invalid input: ID required"]));
}

$id = intval($data['id']); // Employee_ID

$conn->begin_transaction();

try {
    // Check if trying to delete Owner (Admin)
    $check = $conn->query("SELECT Employee_Role, Account_ID FROM EMPLOYEE WHERE Employee_ID = $id");
    if ($check->num_rows == 0) throw new Exception("Staff not found");
    $row = $check->fetch_assoc();
    
    if ($row['Employee_Role'] == 'Admin' || $row['Employee_Role'] == 'Owner') {
        throw new Exception("Cannot delete the Owner/Admin account");
    }

    $accId = $row['Account_ID'];
    
    // Delete ACCOUNT (Cascade will delete EMPLOYEE)
    // Actually, schema: EMPLOYEE has FK to ACCOUNT. ON DELETE CASCADE?
    // Let's check: FOREIGN KEY (Account_ID) REFERENCES ACCOUNT(Account_ID) ON DELETE CASCADE
    // Yes.
    $conn->query("DELETE FROM ACCOUNT WHERE Account_ID = $accId");

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Staff member deleted successfully"]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
