<?php
require 'db_connect.php';
$conn->query("DELETE FROM EMPLOYEE WHERE Employee_Role = 'Owner'");
$conn->query("DELETE FROM ACCOUNT WHERE Username LIKE 'testuser%'");
echo "Owner deleted.";
?>
