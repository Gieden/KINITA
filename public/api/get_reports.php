<?php
require_once 'db_connect.php';

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$response = [
    'revenue' => array_fill(0, 12, 0), // Initialize 12 months with 0
    'categories' => [],
    'daily_transactions' => []
];

try {
    // 1. Monthly Revenue (Current Year)
    $currentYear = date('Y');
    // 1. Monthly Revenue (Current Year)
    $sqlRevenue = "SELECT MONTHNAME(Transaction_Date) as month, SUM(Amount_Total) as revenue 
                   FROM SALE_TRANSACTION 
                   WHERE YEAR(Transaction_Date) = YEAR(CURDATE()) 
                   GROUP BY MONTH(Transaction_Date), MONTHNAME(Transaction_Date) 
                   ORDER BY MONTH(Transaction_Date)";
    
    $resultRevenue = $conn->query($sqlRevenue);
    if ($resultRevenue) {
        while ($row = $resultRevenue->fetch_assoc()) {
            $response['revenue'][date('n', strtotime($row['month'])) - 1] = (float)$row['revenue'];
        }
    }

    // 1.5 Monthly Income (Profit)
    // Logic: Sum of (Sold_Price - Cost_Price) * Sold_Quantity
    // Note: Using Average Cost from INVENTORY_BATCH as a proxy since exact batch tracking wasn't in v1
    $sqlIncome = "SELECT MONTHNAME(st.Transaction_Date) as month, 
                         SUM(std.Sold_Quantity * (std.Sold_Price - COALESCE(
                             (SELECT AVG(Cost_Price) FROM INVENTORY_BATCH WHERE Product_ID = std.Product_ID), 0
                         ))) as income
                  FROM SALE_TRANSACTION st
                  JOIN SALE_TRANSACTION_DETAIL std ON st.SaleTransaction_ID = std.Sale_Transaction_ID
                  WHERE YEAR(st.Transaction_Date) = YEAR(CURDATE())
                  GROUP BY MONTH(st.Transaction_Date), MONTHNAME(st.Transaction_Date)
                  ORDER BY MONTH(st.Transaction_Date)";

    $response['income'] = array_fill(0, 12, 0);
    $resultIncome = $conn->query($sqlIncome);
    if ($resultIncome) {
        while ($row = $resultIncome->fetch_assoc()) {
             $response['income'][date('n', strtotime($row['month'])) - 1] = (float)$row['income'];
        }
    }

    // 2. Sales by Category (Percentage)
    $sqlCategory = "SELECT c.Category_Name as name, SUM(d.Sold_Quantity) as value 
                    FROM SALE_TRANSACTION_DETAIL d
                    JOIN PRODUCT p ON d.Product_ID = p.Product_ID
                    LEFT JOIN CATEGORY c ON p.Category_ID = c.Category_ID
                    GROUP BY c.Category_Name";

    $resultCategory = $conn->query($sqlCategory);
    if ($resultCategory) {
        while ($row = $resultCategory->fetch_assoc()) {
            $response['categories'][] = [
                'name' => $row['name'] ? $row['name'] : 'Uncategorized',
                'value' => (int)$row['value']
            ];
        }
    }

    // 3. Transactions per Day (Last 7 Days)
    $sqlDaily = "SELECT 
                    DATE(Transaction_Date) as date, 
                    COUNT(*) as count 
                 FROM SALE_TRANSACTION 
                 WHERE Transaction_Date >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 DAY) 
                 GROUP BY DATE(Transaction_Date) 
                 ORDER BY date ASC";

    $resultDaily = $conn->query($sqlDaily);
    
    // Fill in missing days
    $last7Days = [];
    for ($i = 6; $i >= 0; $i--) {
        $date = date('Y-m-d', strtotime("-$i days"));
        $last7Days[$date] = 0;
    }

    if ($resultDaily) {
        while ($row = $resultDaily->fetch_assoc()) {
            $last7Days[$row['date']] = intval($row['count']);
        }
    }

    // Format for frontend
    foreach ($last7Days as $date => $count) {
        $response['daily_transactions'][] = [
            'date' => date('d M', strtotime($date)), // "03 Feb"
            'full_date' => $date,
            'count' => $count
        ];
    }

    ob_clean();
    echo json_encode(['status' => 'success', 'data' => $response]);

} catch (Exception $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

$conn->close();
?>
