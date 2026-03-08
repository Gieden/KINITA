<?php
require_once 'db_connect.php';

header('Content-Type: application/json');
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$method = $_SERVER['REQUEST_METHOD'];

if ($method == 'GET') {
    $sql = "SELECT Category_ID as id, Category_Name as name FROM CATEGORY ORDER BY Category_Name ASC";
    $result = $conn->query($sql);

    $categories = [];
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $categories[] = $row;
        }
    }
    
    echo json_encode($categories);
}

$conn->close();
?>
