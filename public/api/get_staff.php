<?php
// get_staff.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

try {
    $sql = "SELECT e.Employee_ID as id, 
                   CONCAT(a.First_Name, ' ', a.Last_Name) as full_name, 
                   a.Email as email, 
                   a.Contact_Number as contact_number, 
                   e.Employee_Role as position, 
                   a.Username as username, 
                   a.Face_Descriptor as face_descriptor, 
                   'Active' as status 
            FROM EMPLOYEE e
            JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            ORDER BY a.Created_At DESC";
            
    $result = $conn->query($sql);

    $staff = [];
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $staff[] = [
                'id' => $row['id'],
                'full_name' => $row['full_name'],
                'email' => $row['email'],
                'contact' => $row['contact_number'],
                'role' => $row['position'],
                'username' => $row['username'],
                'status' => $row['status'],
                'face_descriptor' => !empty($row['face_descriptor']) ? json_decode($row['face_descriptor']) : null
            ];
        }
    }
    ob_clean();
    echo json_encode($staff);

} catch (Exception $e) {
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
