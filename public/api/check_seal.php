<?php
// check_seal.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

$host = '127.0.0.1';
$user = 'root';
$pass = '';
$db   = 'kinita_db';

$response = [
    "status" => "success",
    "is_sealed" => false,
    "has_db" => false,
    "server_online" => false
];

// 1. Connect to MySQL Server

// Suppress default PHP warnings so connection failures don't break JSON output
mysqli_report(MYSQLI_REPORT_OFF);

$conn = @new mysqli($host, $user, $pass);

if ($conn->connect_error) {
    echo json_encode([
        "status" => "success", 
        "is_sealed" => false, 
        "has_db" => false, 
        "server_online" => false,
        "error" => $conn->connect_error
    ]);
    exit;
}

$response["server_online"] = true;

// 2. Check if Database exists
$db_check = $conn->query("SHOW DATABASES LIKE '$db'");
if ($db_check && $db_check->num_rows > 0) {
    $response["has_db"] = true;
    
    $conn->select_db($db);

    // 3. Check if EMPLOYEE table exists
    $table_check = $conn->query("SHOW TABLES LIKE 'EMPLOYEE'");
    if ($table_check && $table_check->num_rows > 0) {
        $response["has_tables"] = true;
        // Check for Owner role
        $admin_check = $conn->query("SELECT Employee_ID FROM EMPLOYEE WHERE Employee_Role = 'Owner'");
        if ($admin_check && $admin_check->num_rows > 0) {
            $response["is_sealed"] = true;
        }
    } else {
        // DB exists, but no tables. Keep has_db = true so UI knows it's detected.
        $response["has_tables"] = false;
    }
}

echo json_encode($response);
$conn->close();
?>
