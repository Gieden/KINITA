<?php
// inventory.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method == 'GET') {
        // Stock Movement Logs - Not implemented in simple schema yet
        // Returning empty array to prevent client-side errors if it expects list
        ob_clean();
        echo json_encode([]); 
        
    } elseif ($method == 'POST') {
        // Add Stock (Receiving Goods)
        $data = json_decode(file_get_contents("php://input"));
        
        if (!$data) throw new Exception("Invalid input");

        $productId = intval($data->product_id);
        $quantity = intval($data->quantity);
        $cost = isset($data->cost) ? floatval($data->cost) : 0;
        $expiry = isset($data->expiry) ? $data->expiry : NULL;
        $employeeId = isset($data->employee_id) ? intval($data->employee_id) : 1; // Default to Owner

        $conn->begin_transaction();

        try {
            // 1. Create INVENTORY_BATCH
            $expiryVal = $expiry ? "'$expiry'" : "NULL";
            $sqlBatch = "INSERT INTO INVENTORY_BATCH (Product_ID, Quantity_On_Hand, Cost_Price, Expiry_Date) 
                         VALUES ($productId, $quantity, $cost, $expiryVal)";
            if (!$conn->query($sqlBatch)) throw new Exception("Error creating batch: " . $conn->error);
            $batchId = $conn->insert_id;

            // 2. Update INVENTORY (Upsert)
            $sqlInv = "INSERT INTO INVENTORY (Product_ID, Current_Stock) VALUES ($productId, $quantity)
                       ON DUPLICATE KEY UPDATE Current_Stock = Current_Stock + $quantity";
            if (!$conn->query($sqlInv)) throw new Exception("Error updating inventory: " . $conn->error);

            // 3. Log STOCK_MOVEMENT
            $sqlMov = "INSERT INTO STOCK_MOVEMENT (Product_ID, Batch_ID, Employee_ID, Movement_Type, Quantity_Change) 
                       VALUES ($productId, $batchId, $employeeId, 'Restock', $quantity)";
            if (!$conn->query($sqlMov)) throw new Exception("Error logging movement: " . $conn->error);

            $conn->commit();
            ob_clean();
            echo json_encode(["status" => "success", "message" => "Stock added successfully"]);

        } catch (Exception $e) {
            $conn->rollback();
            throw $e;
        }
    }

} catch (Exception $e) {
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
