<?php
require 'db_connect.php';

header('Content-Type: text/plain');

echo "--- STARTING FIX ---\n";

// 1. Add Email Column
$sql = "ALTER TABLE ACCOUNT ADD COLUMN Email VARCHAR(100) AFTER Username";
if ($conn->query($sql)) {
    echo "SUCCESS: Added Email column to ACCOUNT table.\n";
} else {
    echo "NOTICE: Email column add failed (maybe exists?): " . $conn->error . "\n";
}

// 2. Dump Owner Info
echo "\n--- OWNER INFO ---\n";
$sqlOwner = "SELECT a.Username, a.First_Name, a.Last_Name, a.Email 
             FROM ACCOUNT a 
             JOIN EMPLOYEE e ON a.Account_ID = e.Account_ID 
             WHERE e.Employee_Role IN ('Owner', 'Admin') 
             LIMIT 1";
$res = $conn->query($sqlOwner);
if ($res && $res->num_rows > 0) {
    $row = $res->fetch_assoc();
    echo "USERNAME: " . $row['Username'] . "\n";
    echo "NAME: " . $row['First_Name'] . " " . $row['Last_Name'] . "\n";
    echo "EMAIL: " . ($row['Email'] ? $row['Email'] : "(Not set)") . "\n";
} else {
    echo "No Owner account found.\n";
}

$conn->close();
?>
