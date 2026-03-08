<?php
require 'db_connect.php';

$result = $conn->query("SHOW COLUMNS FROM ACCOUNT");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo $row['Field'] . " - " . $row['Type'] . "\n";
    }
} else {
    echo "Error: " . $conn->error;
}
?>
