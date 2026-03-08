<?php
// register_owner.php
// Suppress warnings/notices to ensure clean JSON output
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

// Start output buffering
ob_start();

$data = json_decode(file_get_contents("php://input"), true);

if (!$data) {
    // Return standard error if input is bad
    ob_clean();
    die(json_encode(["status" => "error", "message" => "Invalid input"]));
}

$conn->begin_transaction();

try {
    // Input Sanitization
    $firstName = $conn->real_escape_string($data['firstName']);
    $lastName = $conn->real_escape_string($data['lastName']);
    $fullName = "$firstName $lastName";
    
    // Use email as username if username not provided
    $email = $conn->real_escape_string($data['email']);
    $username = isset($data['username']) ? $conn->real_escape_string($data['username']) : $email;
    
    $password = $data['password'];
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Face Descriptor Handling
    $faceDescriptor = isset($data['faceDescriptor']) ? json_encode($data['faceDescriptor']) : NULL;
    if($faceDescriptor) {
        $faceDescriptor = $conn->real_escape_string($faceDescriptor);
        $faceDescVal = "'$faceDescriptor'";
    } else {
        $faceDescVal = "NULL";
    }
    
    // 1. Check if Owner Account already exists
    $check = $conn->query("SELECT Employee_ID FROM EMPLOYEE WHERE Employee_Role = 'Owner'");
    if ($check->num_rows > 0) {
        throw new Exception("System is already sealed. Owner account exists.");
    }

    // 2. Create ACCOUNT Record first
    $sqlAcc = "INSERT INTO ACCOUNT (Username, Password, First_Name, Last_Name, Email, Face_Descriptor) 
               VALUES ('$username', '$hash', '$firstName', '$lastName', '$email', $faceDescVal)";
    
    if (!$conn->query($sqlAcc)) {
        throw new Exception("Error creating account record: " . $conn->error);
    }
    $accountId = $conn->insert_id;

    // 3. Create EMPLOYEE Record linked to Account
    $sqlEmp = "INSERT INTO EMPLOYEE (Account_ID, Employee_Role) 
               VALUES ($accountId, 'Owner')";
    
    if (!$conn->query($sqlEmp)) {
        throw new Exception("Error creating employee record: " . $conn->error);
    }
    
    // 3. Seal the Store
    // Ensure store_config exists and is set to sealed
    $sqlSeal = "INSERT INTO store_config (id, store_name, is_sealed) VALUES (1, 'Kinita Store', 1) 
                ON DUPLICATE KEY UPDATE is_sealed = 1";
    
    if (!$conn->query($sqlSeal)) {
        throw new Exception("Error sealing store: " . $conn->error);
    }

    $conn->commit();
    ob_clean();
    echo json_encode(["status" => "success", "message" => "System Sealed. Owner account created."]);

} catch (Exception $e) {
    if (isset($conn)) $conn->rollback();
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

if (isset($conn)) $conn->close();
