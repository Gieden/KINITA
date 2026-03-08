<?php
// dashboard.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method == 'GET') {
        $period = isset($_GET['period']) ? $_GET['period'] : 'this_month';
        $dCond = "";
        $sdCond = "";

        if ($period === 'today') {
            $dCond = "DATE(Transaction_Date) = CURDATE()";
            $sdCond = "DATE(s.Transaction_Date) = CURDATE()";
        } elseif ($period === 'this_week') {
            $dCond = "YEARWEEK(Transaction_Date, 1) = YEARWEEK(CURDATE(), 1)";
            $sdCond = "YEARWEEK(s.Transaction_Date, 1) = YEARWEEK(CURDATE(), 1)";
        } elseif ($period === 'this_year') {
            $dCond = "YEAR(Transaction_Date) = YEAR(CURDATE())";
            $sdCond = "YEAR(s.Transaction_Date) = YEAR(CURDATE())";
        } elseif ($period === 'all_time') {
            $dCond = "1=1";
            $sdCond = "1=1";
        } else { // this_month
            $dCond = "MONTH(Transaction_Date) = MONTH(CURDATE()) AND YEAR(Transaction_Date) = YEAR(CURDATE())";
            $sdCond = "MONTH(s.Transaction_Date) = MONTH(CURDATE()) AND YEAR(s.Transaction_Date) = YEAR(CURDATE())";
        }

        $sqlTotal = "SELECT SUM(Amount_Total) as total, COUNT(*) as count 
                     FROM SALE_TRANSACTION 
                     WHERE $dCond";
                     
        $resTotal = $conn->query($sqlTotal);
        if (!$resTotal) throw new Exception($conn->error);
        $rowTotal = $resTotal->fetch_assoc();
        $totalSales = $rowTotal['total'] ?? 0;
        $transCount = $rowTotal['count'] ?? 0;

        // 2. Sold Items
        $sqlSold = "SELECT SUM(Sold_Quantity) as sold_items 
                    FROM SALE_TRANSACTION_DETAIL d
                    JOIN SALE_TRANSACTION s ON d.Sale_Transaction_ID = s.SaleTransaction_ID
                    WHERE $sdCond";
        $resSold = $conn->query($sqlSold);
        $soldItems = $resSold->fetch_assoc()['sold_items'] ?? 0;

        // 3. Top Selling Items
        $sqlTop = "SELECT p.Product_Name, c.Category_Name, SUM(d.Sold_Quantity) as sold 
                   FROM SALE_TRANSACTION_DETAIL d
                   JOIN PRODUCT p ON d.Product_ID = p.Product_ID
                   JOIN SALE_TRANSACTION s ON d.Sale_Transaction_ID = s.SaleTransaction_ID
                   LEFT JOIN CATEGORY c ON p.Category_ID = c.Category_ID
                   WHERE $sdCond
                   GROUP BY d.Product_ID 
                   ORDER BY sold DESC LIMIT 5";
        
        $resTop = $conn->query($sqlTop);
        $topItems = [];
        if ($resTop) {
            while($row = $resTop->fetch_assoc()) {
                $topItems[] = $row;
            }
        }

        // 4. Stock Status
        // Low: < 10, Out: 0
        $sqlStock = "SELECT 
            COUNT(CASE WHEN Current_Stock <= 0 THEN 1 END) as out_of_stock,
            COUNT(CASE WHEN Current_Stock > 0 AND Current_Stock < 10 THEN 1 END) as low_stock
            FROM INVENTORY";
        $resStock = $conn->query($sqlStock);
        $rowStock = $resStock->fetch_assoc();
        
        $out = $rowStock['out_of_stock'] ?? 0;
        $low = $rowStock['low_stock'] ?? 0;

        // 5. Near Expiry (Next 30 Days)
        $expiry = 0;
        $checkBatch = $conn->query("SHOW TABLES LIKE 'INVENTORY_BATCH'");
        if ($checkBatch && $checkBatch->num_rows > 0) {
            $sqlExpiry = "SELECT COUNT(*) as count FROM INVENTORY_BATCH 
                          WHERE Expiry_Date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)";
            $resExpiry = $conn->query($sqlExpiry);
            if ($resExpiry) $expiry = $resExpiry->fetch_assoc()['count'] ?? 0;
        }

        ob_clean();
        echo json_encode([
            "revenue" => (float)$totalSales,
            "sales_count" => (int)$transCount,
            "sold_items" => (int)$soldItems,
            "top_selling" => $topItems,
            "stock_status" => [
                "low" => (int)$low,
                "out" => (int)$out,
                "expiry" => (int)$expiry
            ]
        ]);
    }

} catch (Exception $e) {
    ob_clean();
    // Return a safe fallback structure even in error, to prevent frontend crash
    echo json_encode([
        "status" => "error", 
        "message" => $e->getMessage(),
        "revenue" => 0,
        "sales_count" => 0,
        "sold_items" => 0,
        "top_selling" => [],
        "stock_status" => ["low" => 0, "out" => 0, "expiry" => 0]
    ]);
}

$conn->close();
?>
