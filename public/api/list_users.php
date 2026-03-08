<?php
require 'db_connect.php';

$sql = "SELECT a.Account_ID, a.First_Name, a.Last_Name, a.Email, e.Employee_ID, e.Employee_Role 
        FROM ACCOUNT a 
        LEFT JOIN EMPLOYEE e ON a.Account_ID = e.Account_ID";

$result = $conn->query($sql);

if ($result) {
    echo "Users:\n";
    while ($row = $result->fetch_assoc()) {
        echo "AccID: " . $row['Account_ID'] . 
             ", Name: " . $row['First_Name'] . " " . $row['Last_Name'] . 
             ", Email: " . $row['Email'] . 
             ", EmpID: " . $row['Employee_ID'] . 
             ", Role: '" . $row['Employee_Role'] . "'\n";
    }
} else {
    echo "Error: " . $conn->error;
}
$conn->close();
?>
