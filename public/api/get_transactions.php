<?php
require_once 'db_connect.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$type = isset($_GET['type']) ? $_GET['type'] : 'sale'; // 'sale' or 'restock'
$limit = isset($_GET['limit']) ? intval($_GET['limit']) : 50;
$search = isset($_GET['search']) ? $conn->real_escape_string($_GET['search']) : '';
$id = isset($_GET['id']) ? intval($_GET['id']) : 0;

if ($id > 0) {
    // Fetch Details for a specific transaction
    if ($type == 'sale') {
        $sql = "SELECT 
                    std.Sale_Detail_ID,
                    p.Product_Name,
                    std.Sold_Quantity,
                    std.Sold_Price,
                    (std.Sold_Quantity * std.Sold_Price) as Subtotal
                FROM SALE_TRANSACTION_DETAIL std
                JOIN PRODUCT p ON std.Product_ID = p.Product_ID
                WHERE std.Sale_Transaction_ID = $id";
    } else {
        // Restock details
        $sql = "SELECT 
                    sm.Movement_ID,
                    p.Product_Name,
                    sm.Quantity_Change as Quantity,
                    ib.Cost_Price,
                    ib.Expiry_Date,
                    ib.Batch_ID
                FROM STOCK_MOVEMENT sm
                JOIN PRODUCT p ON sm.Product_ID = p.Product_ID
                LEFT JOIN INVENTORY_BATCH ib ON sm.Batch_ID = ib.Batch_ID
                WHERE sm.Movement_ID = $id";
    }
    
    $result = $conn->query($sql);
    $details = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $details[] = $row;
        }
    }
    echo json_encode($details);
    exit;
}

if ($type == 'sale') {
    $sql = "SELECT 
                st.SaleTransaction_ID as id,
                st.Transaction_Date as date,
                st.Amount_Total as amount,
                st.Amount_Tendered as amount_tendered,
                st.Amount_Change as amount_change,
                CONCAT(e.Employee_Role, ' ', a.First_Name, ' ', a.Last_Name) as handler_name,
                e.Employee_Role as handler_role,
                a.First_Name as handler_first_name,
                a.Last_Name as handler_last_name
            FROM SALE_TRANSACTION st
            LEFT JOIN EMPLOYEE e ON st.Cashier_Employee_ID = e.Employee_ID
            LEFT JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            WHERE 1=1";

    if (!empty($search)) {
        $sql .= " AND (st.SaleTransaction_ID LIKE '%$search%' OR a.First_Name LIKE '%$search%' OR a.Last_Name LIKE '%$search%' OR CONCAT(a.First_Name, ' ', a.Last_Name) LIKE '%$search%')";
    }

    $sql .= " ORDER BY st.Transaction_Date DESC LIMIT $limit";

} elseif ($type == 'restock') {
    // Restocks are recorded in STOCK_MOVEMENT with Movement_Type = 'Restock'
    $sql = "SELECT 
                sm.Movement_ID as id,
                sm.Movement_Date as date,
                sm.Quantity_Change as quantity,
                p.Product_Name as product_name,
                CONCAT(e.Employee_Role, ' ', a.First_Name, ' ', a.Last_Name) as handler_name,
                e.Employee_Role as handler_role,
                a.First_Name as handler_first_name,
                a.Last_Name as handler_last_name
            FROM STOCK_MOVEMENT sm
            JOIN PRODUCT p ON sm.Product_ID = p.Product_ID
            LEFT JOIN EMPLOYEE e ON sm.Employee_ID = e.Employee_ID
            LEFT JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            WHERE sm.Movement_Type = 'Restock'";

    if (!empty($search)) {
        $sql .= " AND (p.Product_Name LIKE '%$search%' OR a.First_Name LIKE '%$search%' OR a.Last_Name LIKE '%$search%' OR CONCAT(a.First_Name, ' ', a.Last_Name) LIKE '%$search%')";
    }

    $sql .= " ORDER BY sm.Movement_Date DESC LIMIT $limit";
} else {
    echo json_encode([]);
    exit;
}

$result = $conn->query($sql);

$transactions = [];
if ($result) {
    while ($row = $result->fetch_assoc()) {
        // Format date
        $row['date_formatted'] = date("d M, Y h:i A", strtotime($row['date']));
        
        // Format ID for display
        if ($type == 'sale') {
            $row['display_id'] = 'TR' . str_pad($row['id'], 4, '0', STR_PAD_LEFT);
        } else {
            $row['display_id'] = 'RS' . str_pad($row['id'], 4, '0', STR_PAD_LEFT);
        }

        $transactions[] = $row;
    }
}

echo json_encode($transactions);

$conn->close();
?>
