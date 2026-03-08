<?php
// get_batches.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method == 'GET') {
        if (!isset($_GET['product_id'])) {
            throw new Exception("Product ID is required");
        }
        
        $productId = intval($_GET['product_id']);
        
        // Fetch all batches for the product, ordering by expiry date (soonest first)
        $sql = "SELECT Batch_ID, Quantity_On_Hand, Cost_Price, Expiry_Date, Received_Date 
                FROM INVENTORY_BATCH 
                WHERE Product_ID = $productId AND Quantity_On_Hand > 0
                ORDER BY Expiry_Date ASC, Received_Date ASC";
        
        $result = $conn->query($sql);
        
        $batches = [];
        if ($result && $result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                $batches[] = $row;
            }
        }
        
        ob_clean();
        echo json_encode(["status" => "success", "data" => $batches]);

    } else {
        throw new Exception("Invalid request method");
    }

} catch (Exception $e) {
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
