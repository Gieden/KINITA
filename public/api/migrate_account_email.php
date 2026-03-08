<?php
require 'db_connect.php';

$sql = "ALTER TABLE ACCOUNT ADD COLUMN Email VARCHAR(100)";
if ($conn->query($sql) === TRUE) {
    echo "Email column added successfully";
} else {
    echo "Error or column already exists: " . $conn->error;
}
$conn->close();
?>
