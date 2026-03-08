<?php
// login.php
// Suppress warnings/notices to ensure clean JSON output
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

// Prepare default error response
$response = ["status" => "error", "message" => "Unknown error"];

try {
    $input = file_get_contents("php://input");
    $data = json_decode($input);

    if (!$data) {
        throw new Exception("Invalid JSON input");
    }

    $username = isset($data->username) ? $conn->real_escape_string($data->username) : '';
    $password = isset($data->password) ? $data->password : '';

    if (empty($username) || empty($password)) {
        throw new Exception("Username and Password are required");
    }

    // Query joining ACCOUNT and EMPLOYEE
    $sql = "SELECT a.Account_ID, a.Password, a.First_Name, a.Last_Name, a.Face_Descriptor, e.Employee_ID, e.Employee_Role 
            FROM ACCOUNT a 
            JOIN EMPLOYEE e ON a.Account_ID = e.Account_ID 
            WHERE a.Username = '$username'";

    $result = $conn->query($sql);

    if ($result && $result->num_rows > 0) {
        $row = $result->fetch_assoc();
        
        // Verify Password
        if (password_verify($password, $row['Password'])) {
            $response = [
                "status" => "success",
                "message" => "Login successful",
                "user" => [
                    "account_id" => $row['Account_ID'],
                    "employee_id" => $row['Employee_ID'],
                    "name" => trim($row['First_Name'] . ' ' . $row['Last_Name']),
                    "role" => $row['Employee_Role'],
                    "face_descriptor" => $row['Face_Descriptor'] ? json_decode($row['Face_Descriptor']) : null
                ]
            ];
        } else {
            $response = ["status" => "error", "message" => "Invalid credentials"];
        }
    } else {
        $response = ["status" => "error", "message" => "User not found"];
    }

} catch (Exception $e) {
    $response = ["status" => "error", "message" => $e->getMessage()];
}

// Ensure clean output
ob_clean(); 
echo json_encode($response);
$conn->close();
?>
