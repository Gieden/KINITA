<?php
// add_staff.php
require 'db_connect.php';

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    die(json_encode(["status" => "error", "message" => "Invalid input"]));
}

// Basic Validation
if (empty($data['name']) || empty($data['email']) || empty($data['role'])) {
    die(json_encode(["status" => "error", "message" => "Missing required fields"]));
}

$conn->begin_transaction();

try {
    $email = $conn->real_escape_string($data['email']);
    
    // Check for duplicates (Username or Email)
    $username = null;
    $checkSql = "SELECT Account_ID FROM ACCOUNT WHERE Email = '$email'";
    
    if (!empty($data['username'])) {
        $username = $conn->real_escape_string($data['username']);
        $checkSql .= " OR Username = '$username'";
    } else {
        // If no username provided, use email as username or generate unique
        $username = $email; 
        $checkSql .= " OR Username = '$username'";
    }

    $checkResult = $conn->query($checkSql);
    if ($checkResult->num_rows > 0) {
        throw new Exception("Email or Username already exists");
    }

    // Split Name
    $fullName = $conn->real_escape_string($data['name']);
    $parts = explode(" ", $fullName);
    $firstName = $parts[0];
    $lastName = isset($parts[1]) ? end($parts) : '';
    $contact = $conn->real_escape_string($data['contact']);
    $role = $conn->real_escape_string($data['role']);

    // Password
    $password_hash = '';
    if (!empty($data['password'])) {
        $password_hash = password_hash($data['password'], PASSWORD_DEFAULT);
    } else {
        // Generate random password if not provided (account exists but not accessible via login)
        $password_hash = password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT);
    }

    // Face Descriptor
    $faceDescriptor = null;
    if (!empty($data['faceDescriptor'])) {
        $faceDescriptor = $conn->real_escape_string(json_encode($data['faceDescriptor']));
    }

    // 1. Insert ACCOUNT
    // Note: Assuming 'Face_Descriptor' column exists in ACCOUNT table (self-healing should have added it by now)
    $sqlAcc = "INSERT INTO ACCOUNT (Username, Password, First_Name, Last_Name, Email, Contact_Number, Face_Descriptor) 
               VALUES ('$username', '$password_hash', '$firstName', '$lastName', '$email', '$contact', " . ($faceDescriptor ? "'$faceDescriptor'" : "NULL") . ")";
    
    if (!$conn->query($sqlAcc)) {
        throw new Exception("Error creating account: " . $conn->error);
    }
    $accId = $conn->insert_id;

    // 2. Insert EMPLOYEE
    $sqlEmp = "INSERT INTO EMPLOYEE (Account_ID, Employee_Role) VALUES ($accId, '$role')";
    
    if (!$conn->query($sqlEmp)) {
        throw new Exception("Error creating employee record: " . $conn->error);
    }
    $empId = $conn->insert_id;

    $conn->commit();
    echo json_encode(["status" => "success", "message" => "Staff member added successfully", "id" => $empId]);

} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
