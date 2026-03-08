<?php
// get_enrolled_users.php
require 'db_connect.php';

header('Content-Type: application/json');

try {
    // Select users with face descriptors
    // Note: Face_Descriptor might be NULL or empty string
    $sql = "SELECT Employee_ID, Account_ID, Employee_Role FROM EMPLOYEE";
    
    // We need to join with ACCOUNT to get the Name and Descriptor
    $sql = "SELECT e.Employee_ID, e.Employee_Role, a.First_Name, a.Last_Name, a.Face_Descriptor 
            FROM EMPLOYEE e
            JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            WHERE a.Face_Descriptor IS NOT NULL AND a.Face_Descriptor != ''";
            
    $result = $conn->query($sql);
    
    $users = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $users[] = [
                "id" => $row['Employee_ID'],
                "name" => $row['First_Name'] . ' ' . $row['Last_Name'],
                "role" => $row['Employee_Role'],
                "face_descriptor" => json_decode($row['Face_Descriptor'])
            ];
        }
    }
    
    echo json_encode($users);

} catch (Exception $e) {
    echo json_encode([]);
}

$conn->close();
?>
