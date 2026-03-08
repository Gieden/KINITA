<?php
// init_db.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Output buffering to prevent stray characters
ob_start();

$host = '127.0.0.1';
$user = 'root';
$pass = '';

$response = ["status" => "error", "message" => "Unknown error"];

// Suppress default PHP warnings to prevent them from breaking the JSON response
mysqli_report(MYSQLI_REPORT_OFF);

try {
    $conn = @new mysqli($host, $user, $pass);
    if ($conn->connect_error) {
        $error_msg = $conn->connect_error;
        if (strpos($error_msg, 'actively refused') !== false || 
            strpos($error_msg, 'No connection could be made') !== false ||
            strpos($error_msg, 'Connection refused') !== false ||
            strpos($error_msg, '2002') !== false) {
            throw new Exception("Database connection failed. Please ensure XAMPP (MySQL) is running on the Master node.");
        }
        throw new Exception("MySQL Connection Failed: " . $error_msg);
    }

    $sqlFile = '../../database/setup.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("setup.sql file not found.");
    }

    $sql = file_get_contents($sqlFile);

    if ($conn->multi_query($sql)) {
        // Clear results
        do {
            if ($res = $conn->store_result()) {
                $res->free();
            }
        } while ($conn->more_results() && $conn->next_result());
        
        $response = ["status" => "success", "message" => "Database initialized successfully"];
    } else {
        throw new Exception("Error executing SQL: " . $conn->error);
    }
    
    $conn->close();

} catch (Exception $e) {
    $response = ["status" => "error", "message" => $e->getMessage()];
}

ob_end_clean(); // Clean any previous output (warnings etc)
echo json_encode($response);
?>
