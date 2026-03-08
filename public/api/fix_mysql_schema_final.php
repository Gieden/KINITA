<?php
// fix_mysql_schema_final.php
require 'db_connect.php';

header('Content-Type: application/json');

$response = ["log" => []];

function logMsg($msg) {
    global $response;
    $response['log'][] = $msg;
}

// 1. Check if column exists
$check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Face_Descriptor'");
if ($check->num_rows == 0) {
    logMsg("Column Face_Descriptor does not exist. Attempting to add...");
    
    // Add column
    if ($conn->query("ALTER TABLE ACCOUNT ADD COLUMN Face_Descriptor TEXT")) {
        logMsg("SUCCESS: Added Face_Descriptor column to ACCOUNT table.");
    } else {
        logMsg("ERROR: Failed to add column: " . $conn->error);
    }
} else {
    logMsg("Column Face_Descriptor already exists.");
}

// 2. Verify it exists now
$verify = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Face_Descriptor'");
if ($verify->num_rows > 0) {
    $response['status'] = 'success';
    $response['message'] = "Schema is correct. Face_Descriptor exists.";
} else {
    $response['status'] = 'error';
    $response['message'] = "Schema is still incorrect.";
}

echo json_encode($response);
$conn->close();
?>
