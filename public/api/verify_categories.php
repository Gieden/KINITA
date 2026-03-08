<?php
require 'db_connect.php';

$result = $conn->query("SELECT name FROM categories ORDER BY id");
if ($result->num_rows > 0) {
    echo "Categories in DB:\n";
    while($row = $result->fetch_assoc()) {
        echo "- " . $row['name'] . "\n";
    }
}
$conn->close();
?>
