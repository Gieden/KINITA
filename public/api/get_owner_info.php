<?php
require 'db_connect.php';

$sql = "SELECT a.Username, a.Email 
        FROM ACCOUNT a 
        JOIN EMPLOYEE e ON a.Account_ID = e.Account_ID 
        WHERE e.Employee_Role = 'Admin' OR e.Employee_Role = 'Owner'
        LIMIT 1";

$result = $conn->query($sql);

if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    echo "Username: " . $row['Username'] . "\n";
    echo "Email: " . $row['Email'] . "\n";
} else {
    echo "No Owner/Admin account found.\n";
}
$conn->close();
?>
