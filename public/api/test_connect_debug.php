<?php
$host = '127.0.0.1';
$user = 'root';
$pass = '';

mysqli_report(MYSQLI_REPORT_STRICT | MYSQLI_REPORT_ALL);
try {
    $conn = new mysqli($host, $user, $pass);
    echo "Connection successful!";
} catch (mysqli_sql_exception $e) {
    echo "Connection failed: " . $e->getMessage();
}
?>
