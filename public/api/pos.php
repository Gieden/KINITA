<?php
// pos.php
error_reporting(0);
ini_set('display_errors', 0);

require_once 'db_connect.php';

ob_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method == 'POST') {
        $input = file_get_contents("php://input");
        $data = json_decode($input);
        
        if (!$data) {
            throw new Exception("Invalid JSON input");
        }

        $action = isset($data->action) ? $data->action : '';

        if ($action == 'checkout') {
            // Validation: Ensure tables exist
            $checkTable = $conn->query("SHOW TABLES LIKE 'PRODUCT'");
            if ($checkTable->num_rows == 0) {
                 throw new Exception("Database schema mismatch. Please run reset_db.php");
            }

            $cashierId = isset($data->cashier_id) ? intval($data->cashier_id) : 1;
            $items = isset($data->items) ? $data->items : [];
            $totalAmount = isset($data->amount_total) ? floatval($data->amount_total) : 0.00;
            $tendered = isset($data->amount_tendered) ? floatval($data->amount_tendered) : 0.00;
            
            // Recalculate change to be safe
            $change = $tendered - $totalAmount;

            if ($change < 0) {
                throw new Exception("Insufficient payment");
            }

            if (empty($items)) {
                throw new Exception("Cart is empty");
            }

            $conn->begin_transaction();

            try {
                // 1. Create Sale Transaction
                $sqlSale = "INSERT INTO SALE_TRANSACTION (Cashier_Employee_ID, Amount_Total, Amount_Tendered, Amount_Change) 
                            VALUES ($cashierId, $totalAmount, $tendered, $change)";
                if (!$conn->query($sqlSale)) throw new Exception("Error creating transaction: " . $conn->error);
                $transactionId = $conn->insert_id;

                // 2. Process each item
                foreach ($items as $item) {
                    $prodId = intval($item->product_id);
                    $qtyNeeded = intval($item->quantity);
                    $price = floatval($item->price);

                    // Check total stock from INVENTORY
                    $resStock = $conn->query("SELECT Current_Stock FROM INVENTORY WHERE Product_ID = $prodId FOR UPDATE");
                    if (!$resStock || $resStock->num_rows == 0) {
                         throw new Exception("Product ID $prodId not found in Inventory");
                    }
                    $stockRow = $resStock->fetch_assoc();
                    
                    if ($stockRow['Current_Stock'] < $qtyNeeded) {
                        throw new Exception("Insufficient stock for Product ID: $prodId");
                    }

                    // Log Sale Detail
                    $conn->query("INSERT INTO SALE_TRANSACTION_DETAIL (Sale_Transaction_ID, Product_ID, Sold_Quantity, Sold_Price) 
                                  VALUES ($transactionId, $prodId, $qtyNeeded, $price)");
                    $detailId = $conn->insert_id;

                    // Update Stock
                    $conn->query("UPDATE INVENTORY SET Current_Stock = Current_Stock - $qtyNeeded WHERE Product_ID = $prodId");
                    
                    // Log Movement
                    // Note: Sale_Detail_ID is used to link back to the specific line item
                    $conn->query("INSERT INTO STOCK_MOVEMENT (Product_ID, Sale_Detail_ID, Employee_ID, Movement_Type, Quantity_Change) 
                                  VALUES ($prodId, $detailId, $cashierId, 'Sale', -$qtyNeeded)");
                }

                $conn->commit();
                ob_clean();
                echo json_encode(["status" => "success", "message" => "Transaction completed", "transaction_id" => $transactionId]);

            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
        } else {
            throw new Exception("Invalid action");
        }
    } else {
        throw new Exception("Invalid request method");
    }
} catch (Exception $e) {
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
