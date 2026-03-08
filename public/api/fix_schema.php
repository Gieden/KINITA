<?php
// fix_schema.php
require 'db_connect.php';

header("Content-Type: text/plain");

echo "Checking schema...\n";

// 1. Add Email to ACCOUNT
$check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Email'");
if ($check->num_rows == 0) {
    echo "Adding Email column to ACCOUNT...\n";
    $sql = "ALTER TABLE ACCOUNT ADD COLUMN Email VARCHAR(100)";
    if ($conn->query($sql)) {
        echo "SUCCESS: Email column added.\n";
    } else {
        echo "ERROR: " . $conn->error . "\n";
    }
} else {
    echo "Email column already exists in ACCOUNT.\n";
}

// 2. Add Username to ACCOUNT (if missing, though setup.sql has it)
$check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Username'");
if ($check->num_rows == 0) {
    echo "Adding Username column to ACCOUNT...\n";
    $sql = "ALTER TABLE ACCOUNT ADD COLUMN Username VARCHAR(50) UNIQUE";
    if ($conn->query($sql)) {
        echo "SUCCESS: Username column added.\n";
    } else {
        echo "ERROR: " . $conn->error . "\n";
    }
} else {
    echo "Username column already exists in ACCOUNT.\n";
}

echo "\nDone.";
$conn->close();
?>
