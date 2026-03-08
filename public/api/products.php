<?php
// products.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method == 'GET') {
        // Updated for new schema: PRODUCT table with separate INVENTORY table
        $sql = "SELECT p.Product_ID, p.Product_Name, p.Barcode, 
                       p.Current_Price, 
                       c.Category_Name,
                       (SELECT COALESCE(Current_Stock, 0) FROM INVENTORY WHERE Product_ID = p.Product_ID) as Current_Stock
                FROM PRODUCT p 
                LEFT JOIN CATEGORY c ON p.Category_ID = c.Category_ID
                ORDER BY p.Product_Name ASC";
        
        $result = $conn->query($sql);
        
        $products = [];
        if ($result && $result->num_rows > 0) {
            while($row = $result->fetch_assoc()) {
                $products[] = $row;
            }
        }
        
        ob_clean();
        echo json_encode($products);

    } elseif ($method == 'POST') {
        // Add Product
        $data = json_decode(file_get_contents("php://input"));
        
        if (!$data) throw new Exception("Invalid input");

        $name = $conn->real_escape_string($data->name);
        $rawSku = isset($data->barcode) ? trim($data->barcode) : (isset($data->sku) ? trim($data->sku) : '');
        $price = floatval($data->price);
        $categoryName = $conn->real_escape_string($data->category);
        
        // Validation: Check for Duplicate Name
        $checkName = $conn->query("SELECT Product_ID FROM PRODUCT WHERE Product_Name = '$name'");
        if ($checkName && $checkName->num_rows > 0) {
             throw new Exception("Product name '$name' already exists.");
        }
        
        // Handle Empty SKU/Barcode
        if (empty($rawSku)) {
            $sku = "AUTO-" . strtoupper(uniqid()); 
        } else {
            $sku = $conn->real_escape_string($rawSku);
        }

        // Resolve Category ID
        $catId = "NULL";
        if (isset($data->category_id) && !empty($data->category_id)) {
            $catId = intval($data->category_id);
        } elseif (!empty($categoryName)) {
             $resCat = $conn->query("SELECT Category_ID FROM CATEGORY WHERE Category_Name = '$categoryName'");
             if ($resCat && $resCat->num_rows > 0) {
                 $catId = $resCat->fetch_assoc()['Category_ID'];
             } else {
                 // Create Category if not exists
                 $conn->query("INSERT INTO CATEGORY (Category_Name) VALUES ('$categoryName')");
                 $catId = $conn->insert_id;
             }
        }

        $sql = "INSERT INTO PRODUCT (Product_Name, Barcode, Current_Price, Category_ID) 
                VALUES ('$name', '$sku', $price, $catId)";
        
        if ($conn->query($sql)) {
            $productId = $conn->insert_id;
            
            // Handle Initial Stock if provided
            $initialQty = isset($data->quantity) ? intval($data->quantity) : 0;
            $initialCost = isset($data->cost) ? floatval($data->cost) : 0;
            $initialExpiry = isset($data->expiry) && !empty($data->expiry) ? $data->expiry : NULL;
            $employeeId = isset($data->employee_id) ? intval($data->employee_id) : 1;

            if ($initialQty > 0) {
                // 1. Create INVENTORY_BATCH
                $expiryVal = $initialExpiry ? "'$initialExpiry'" : "NULL";
                $sqlBatch = "INSERT INTO INVENTORY_BATCH (Product_ID, Quantity_On_Hand, Cost_Price, Expiry_Date) 
                             VALUES ($productId, $initialQty, $initialCost, $expiryVal)";
                $conn->query($sqlBatch);
                $batchId = $conn->insert_id;

                // 2. Insert into INVENTORY
                $conn->query("INSERT INTO INVENTORY (Product_ID, Current_Stock) VALUES ($productId, $initialQty)");

                // 3. Log Movement
                $conn->query("INSERT INTO STOCK_MOVEMENT (Product_ID, Batch_ID, Employee_ID, Movement_Type, Quantity_Change) 
                              VALUES ($productId, $batchId, $employeeId, 'Restock', $initialQty)");
            } else {
                // Initialize empty inventory
                $conn->query("INSERT INTO INVENTORY (Product_ID, Current_Stock) VALUES ($productId, 0)");
            }
            
            ob_clean();
            echo json_encode(["status" => "success", "message" => "Product added successfully", "id" => $productId]);
        } else {
            throw new Exception("Error adding product: " . $conn->error);
        }

    } elseif ($method == 'PUT') {
        // Update Price
        $data = json_decode(file_get_contents("php://input"));
        $id = intval($data->id);
        
        if (isset($data->price)) {
             $price = floatval($data->price);
             $employeeId = isset($data->employee_id) ? intval($data->employee_id) : 1;
             
             // Get Old Price
             $oldPrice = 0;
             $res = $conn->query("SELECT Current_Price FROM PRODUCT WHERE Product_ID = $id");
             if ($res && $res->num_rows > 0) $oldPrice = $res->fetch_assoc()['Current_Price'];

             $sql = "UPDATE PRODUCT SET Current_Price = $price WHERE Product_ID = $id";
             if ($conn->query($sql)) {
                 // Log Price History
                 $conn->query("INSERT INTO PRICE_HISTORY (Product_ID, Employee_ID, Old_Price, New_Price) 
                               VALUES ($id, $employeeId, $oldPrice, $price)");
                               
                 ob_clean();
                 echo json_encode(["status" => "success", "message" => "Price updated successfully"]);
             } else {
                 throw new Exception("Error updating price: " . $conn->error);
             }
        }
    }

} catch (Exception $e) {
    ob_clean();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}

$conn->close();
?>
