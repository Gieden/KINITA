<?php
require 'db_connect.php';

$result = $conn->query("DESCRIBE EMPLOYEE");

if ($result) {
    echo "Columns in EMPLOYEE table:\n";
    while ($row = $result->fetch_assoc()) {
        echo $row['Field'] . " - " . $row['Type'] . "\n";
    }
} else {
    echo "Error describing table: " . $conn->error;
}
$conn->close();
?>
