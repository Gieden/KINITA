<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db = 'kinita_db';

// Suppress default PHP warnings to prevent them from breaking the JSON response
mysqli_report(MYSQLI_REPORT_OFF);

$conn = @new mysqli($host, $user, $pass, $db);

if ($conn->connect_error) {
    $error_msg = $conn->connect_error;
    
    // Check for common connection issues indicating MySQL/XAMPP is offline
    if (strpos($error_msg, 'actively refused') !== false || 
        strpos($error_msg, 'No connection could be made') !== false ||
        strpos($error_msg, 'Connection refused') !== false ||
        strpos($error_msg, '2002') !== false) {
        die(json_encode([
            "status" => "error", 
            "message" => "Database connection failed. Please ensure XAMPP (MySQL) is running."
        ]));
    }
    
    // Check for missing database
    if (strpos($error_msg, 'Unknown database') !== false ||
        strpos($error_msg, '1049') !== false) {
        die(json_encode([
            "status" => "error", 
            "message" => "Database 'kinita_db' not found. Please create the database in XAMPP."
        ]));
    }

    die(json_encode([
        "status" => "error", 
        "message" => "Database Connection Failed: " . $error_msg
    ]));
}
