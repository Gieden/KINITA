<?php
require 'db_connect.php';

echo "Checking Employee Table:\n";
$result = $conn->query("SELECT * FROM EMPLOYEE");
if ($result) {
    while ($row = $result->fetch_assoc()) {
        echo "ID: " . $row['Employee_ID'] . ", Role: " . $row['Employee_Role'] . "\n";
    }
} else {
    echo "Error querying EMPLOYEE: " . $conn->error . "\n";
}

echo "\nRunning Seal Check Logic:\n";
$admin_check = $conn->query("SELECT Employee_ID FROM EMPLOYEE WHERE Employee_Role = 'Owner'");
if ($admin_check && $admin_check->num_rows > 0) {
    echo "IS_SEALED: TRUE\n";
} else {
    echo "IS_SEALED: FALSE\n";
}
$conn->close();
?>
