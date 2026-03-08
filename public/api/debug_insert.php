<?php
header('Content-Type: text/plain');
require 'db_connect.php';

$username = 'debug_test_' . time();
$password = 'password';
$hash = password_hash($password, PASSWORD_DEFAULT);
$firstName = 'Debug';
$middleName = '';
$lastName = 'User';
$faceDescVal = "NULL";

$sqlAcc = "INSERT INTO ACCOUNT (Username, Password, First_Name, Middle_Name, Last_Name, Email, Face_Descriptor) 
           VALUES ('$username', '$hash', '$firstName', '$middleName', '$lastName', NULL, $faceDescVal)";

echo "Query: $sqlAcc\n";

if ($conn->query($sqlAcc)) {
    echo "INSERT SUCCESSFUL. ID: " . $conn->insert_id . "\n";
    // Clean up
    $conn->query("DELETE FROM ACCOUNT WHERE Account_ID = " . $conn->insert_id);
} else {
    echo "INSERT FAILED: " . $conn->error . "\n";
}
?>
