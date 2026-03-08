<?php
// debug_register.php
// Force error display to be off, capture everything
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json");

ob_start();

try {
    require 'db_connect.php';

    // Log input
    $rawInput = file_get_contents("php://input");
    file_put_contents("debug_log.txt", "Input: " . $rawInput . "\n", FILE_APPEND);

    $data = json_decode($rawInput, true);

    if (!$data) {
        throw new Exception("Invalid input: " . json_last_error_msg());
    }

    $conn->begin_transaction();

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
    
    file_put_contents("debug_log.txt", "Processing User: $username\n", FILE_APPEND);

    // 1. Check if Owner Account already exists
    $check = $conn->query("SELECT id FROM employees WHERE position = 'Owner'");
    if (!$check) {
        throw new Exception("Query Failed: " . $conn->error);
    }
    if ($check->num_rows > 0) {
        throw new Exception("System is already sealed. Owner account exists.");
    }

    // 2. Create EMPLOYEE Record
    $securityKey = "123456"; 
    
    $sqlEmp = "INSERT INTO employees (full_name, username, password_hash, position, email, security_key, face_descriptor) 
               VALUES ('$fullName', '$username', '$hash', 'Owner', '$email', '$securityKey', $faceDescVal)";

    if (!$conn->query($sqlEmp)) {
        throw new Exception("Error creating owner record: " . $conn->error);
    }
    
    // 3. Seal the Store
    $sqlSeal = "INSERT INTO store_config (id, store_name, is_sealed) VALUES (1, 'Kinita Store', 1) 
                ON DUPLICATE KEY UPDATE is_sealed = 1";
    
    if (!$conn->query($sqlSeal)) {
        throw new Exception("Error sealing store: " . $conn->error);
    }

    $conn->commit();
    $response = ["status" => "success", "message" => "System Sealed. Owner account created."];

} catch (Exception $e) {
    if (isset($conn)) $conn->rollback();
    file_put_contents("debug_log.txt", "Error: " . $e->getMessage() . "\n", FILE_APPEND);
    $response = ["status" => "error", "message" => $e->getMessage()];
}

// Clear buffer to remove any warnings/notices
$output = ob_get_clean();
if (!empty($output)) {
    file_put_contents("debug_log.txt", "Unexpected Output: " . $output . "\n", FILE_APPEND);
}

echo json_encode($response);
if (isset($conn)) $conn->close();
?>
