<?php
require 'db_connect.php';

echo "Checking for products missing Inventory records...\n";

// Find products that don't have an entry in INVENTORY table
$sql = "SELECT p.Product_ID, p.Product_Name 
        FROM PRODUCT p 
        LEFT JOIN INVENTORY i ON p.Product_ID = i.Product_ID 
        WHERE i.Product_ID IS NULL";

$result = $conn->query($sql);

if ($result->num_rows > 0) {
    echo "Found " . $result->num_rows . " products without inventory records.\n";
    while($row = $result->fetch_assoc()) {
        $id = $row['Product_ID'];
        $name = $row['Product_Name'];
        echo "Fixing '$name' (ID: $id)... ";
        
        $conn->query("INSERT INTO INVENTORY (Product_ID, Current_Stock) VALUES ($id, 0)");
        echo "Done.\n";
    }
} else {
    echo "All products have valid inventory records.\n";
}

// Optional: Recalculate stock based on Batches?
// Only if requested, but for now let's just ensure the row exists.

// Recalculate Sum from Batches just in case
echo "Recalculating stock totals from batches...\n";
$sqlRecalc = "SELECT Product_ID, SUM(Quantity_On_Hand) as Total FROM INVENTORY_BATCH GROUP BY Product_ID";
$resRecalc = $conn->query($sqlRecalc);
while($row = $resRecalc->fetch_assoc()) {
    $pid = $row['Product_ID'];
    $total = $row['Total'];
    $conn->query("UPDATE INVENTORY SET Current_Stock = $total WHERE Product_ID = $pid");
}
echo "Stock totals synchronized.";

$conn->close();
?>
