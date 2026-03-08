<?php
require_once 'db_connect.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$type = isset($_GET['type']) ? $_GET['type'] : 'sale'; // 'sale' or 'restock'
$search = isset($_GET['search']) ? $conn->real_escape_string($_GET['search']) : '';

// Set headers for CSV download
$filename = "transactions_" . $type . "_" . date('Y-m-d') . ".csv";
header('Content-Type: text/csv');
header('Content-Disposition: attachment; filename="' . $filename . '"');

$output = fopen('php://output', 'w');

if ($type == 'sale') {
    // Header Row
    fputcsv($output, ['Transaction ID', 'Date', 'Amount', 'Handled By', 'Role']);

    $sql = "SELECT 
                st.SaleTransaction_ID as id,
                st.Transaction_Date as date,
                st.Amount_Total as amount,
                CONCAT(a.First_Name, ' ', a.Last_Name) as handler_name,
                e.Employee_Role as handler_role
            FROM SALE_TRANSACTION st
            LEFT JOIN EMPLOYEE e ON st.Cashier_Employee_ID = e.Employee_ID
            LEFT JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            WHERE 1=1";

    if (!empty($search)) {
        $sql .= " AND (st.SaleTransaction_ID LIKE '%$search%' OR a.First_Name LIKE '%$search%' OR a.Last_Name LIKE '%$search%')";
    }

    $sql .= " ORDER BY st.Transaction_Date DESC"; // No Limit for export

    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            fputcsv($output, [
                'TR' . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
                date("Y-m-d H:i:s", strtotime($row['date'])),
                number_format($row['amount'], 2),
                $row['handler_name'],
                $row['handler_role']
            ]);
        }
    }

} elseif ($type == 'restock') {
    // Header Row
    fputcsv($output, ['Movement ID', 'Date', 'Product', 'Quantity Change', 'Handled By', 'Role']);

    $sql = "SELECT 
                sm.Movement_ID as id,
                sm.Movement_Date as date,
                sm.Quantity_Change as quantity,
                p.Product_Name as product_name,
                CONCAT(a.First_Name, ' ', a.Last_Name) as handler_name,
                e.Employee_Role as handler_role
            FROM STOCK_MOVEMENT sm
            JOIN PRODUCT p ON sm.Product_ID = p.Product_ID
            LEFT JOIN EMPLOYEE e ON sm.Employee_ID = e.Employee_ID
            LEFT JOIN ACCOUNT a ON e.Account_ID = a.Account_ID
            WHERE sm.Movement_Type = 'Restock'";

    if (!empty($search)) {
        $sql .= " AND (p.Product_Name LIKE '%$search%' OR a.First_Name LIKE '%$search%' OR a.Last_Name LIKE '%$search%')";
    }

    $sql .= " ORDER BY sm.Movement_Date DESC";

    $result = $conn->query($sql);
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            fputcsv($output, [
                'RS' . str_pad($row['id'], 4, '0', STR_PAD_LEFT),
                date("Y-m-d H:i:s", strtotime($row['date'])),
                $row['product_name'],
                $row['quantity'],
                $row['handler_name'],
                $row['handler_role']
            ]);
        }
    }
}

fclose($output);
$conn->close();
