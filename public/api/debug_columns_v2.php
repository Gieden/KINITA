<?php
header('Content-Type: text/plain');
require 'db_connect.php';

echo "Database: " . $dbname . "\n";
echo "Host: " . $servername . "\n";

$result = $conn->query("SHOW COLUMNS FROM ACCOUNT");
if ($result) {
    echo "Columns in ACCOUNT table:\n";
    while ($row = $result->fetch_assoc()) {
        echo $row['Field'] . "\n";
    }
} else {
    echo "Error showing columns: " . $conn->error . "\n";
}

// Check specifically for Face_Descriptor
$check = $conn->query("SHOW COLUMNS FROM ACCOUNT LIKE 'Face_Descriptor'");
if ($check->num_rows > 0) {
    echo "Face_Descriptor FOUND.\n";
} else {
    echo "Face_Descriptor NOT FOUND.\n";
}
?>
