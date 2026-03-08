<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';

$conn = new mysqli($host, $user, $pass);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully to MySQL server.\n";

if ($conn->select_db('kinita_db')) {
    echo "Selected kinita_db successfully.\n";
} else {
    echo "Could not select kinita_db (might not exist).\n";
}

$conn->close();
?>
