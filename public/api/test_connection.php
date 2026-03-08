<?php
header("Content-Type: text/plain");

$host = '127.0.0.1';
$user = 'root';
$pass = '';

echo "1. Testing connection to MySQL Server ($host)...\n";
$conn = new mysqli($host, $user, $pass);

if ($conn->connect_error) {
    echo "FAIL: " . $conn->connect_error . "\n";
    echo "Global SQL Mode: " . ($conn->query("SELECT @@sql_mode")->fetch_row()[0] ?? 'Unknown') . "\n";
    exit;
}
echo "SUCCESS: Connected to MySQL Server.\n";

echo "2. Checking for database 'kinita_db'...\n";
$db_selected = $conn->select_db('kinita_db');
if (!$db_selected) {
    echo "FAIL: Database 'kinita_db' does not exist or cannot be selected.\n";
    echo "Error: " . $conn->error . "\n";
} else {
    echo "SUCCESS: Database 'kinita_db' selected.\n";
    
    echo "3. Listing Tables...\n";
    $result = $conn->query("SHOW TABLES");
    while ($row = $result->fetch_row()) {
        echo " - " . $row[0] . "\n";
    }
}

$conn->close();
?>
