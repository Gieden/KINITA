<?php
// update_staff.php
require 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['id'])) {
    die(json_encode(["status" => "error", "message" => "Invalid input: ID required"]));
}

$id = intval($data['id']); // This is Employee_ID
$name = $conn->real_escape_string($data['name']);
$email = $conn->real_escape_string($data['email']);
$contact = $conn->real_escape_string($data['contact']);
$role = $conn->real_escape_string($data['role']);

// Split Name
$parts = explode(" ", $name);
$firstName = $parts[0];
$lastName = isset($parts[1]) ? end($parts) : 'Staff';

$conn->begin_transaction();

try {
    // Get Account_ID from Employee_ID
    $res = $conn->query("SELECT Account_ID FROM EMPLOYEE WHERE Employee_ID = $id");
    if ($res->num_rows == 0) throw new Exception("Staff not found");
    $accRow = $res->fetch_assoc();
    $accId = $accRow['Account_ID'];

    // Update ACCOUNT
    $sqlAcc = "UPDATE ACCOUNT SET First_Name = '$firstName', Last_Name = '$lastName', Email = '$email', Contact_Number = '$contact' WHERE Account_ID = $accId";
    $conn->query($sqlAcc);

    // Update Username if provided
    if (!empty($data['username'])) {
        $username = $conn->real_escape_string($data['username']);
        $conn->query("UPDATE ACCOUNT SET Username = '$username' WHERE Account_ID = $accId");
    }

    // Update Password if provided
    if (!empty($data['password']) && $data['password'] !== '••••••') {
        $hash = password_hash($data['password'], PASSWORD_DEFAULT);
        $conn->query("UPDATE ACCOUNT SET Password = '$hash' WHERE Account_ID = $accId");
    }

    // Update EMPLOYEE Role
    $sqlEmp = "UPDATE EMPLOYEE SET Employee_Role = '$role' WHERE Employee_ID = $id";
    $conn->query($sqlEmp);

    // Update Face Descriptor if provided
    if (isset($data['faceDescriptor']) && !empty($data['faceDescriptor'])) {
        $faceDescriptor = $conn->real_escape_string(json_encode($data['faceDescriptor']));
        $conn->query("UPDATE ACCOUNT SET Face_Descriptor = '$faceDescriptor' WHERE Account_ID = $accId");
    }

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Staff member updated successfully"]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
