<?php
require 'db_connect.php';

$table = 'ACCOUNT';
$result = $conn->query("SHOW COLUMNS FROM $table");

if ($result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        echo $row['Field'] . " - " . $row['Type'] . "\n";
    }
} else {
    echo "Table $table not found or empty.";
}
$conn->close();
?>
