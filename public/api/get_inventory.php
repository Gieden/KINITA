<?php
// get_inventory.php
error_reporting(0);
ini_set('display_errors', 0);

require 'db_connect.php';

ob_start();

if ($conn->connect_error) {
    ob_clean();
    die(json_encode(["error" => "Connection failed: " . $conn->connect_error]));
}

// Fetch products with their category names and current stock
$sql = "SELECT p.Product_ID as id, 
               p.Product_Name as name, 
               p.SKU as sku, 
               p.Pricing_Retail as price, 
               i.Current_Stock as stock, 
               i.Reorder_Level as reorder_level,
               p.Status as status, 
               p.Image_Path as image, 
               p.Created_At as created_at, 
               c.Category_Name as category_name 
        FROM PRODUCT p
        LEFT JOIN CATEGORY c ON p.Category_ID = c.Category_ID
        LEFT JOIN INVENTORY i ON p.Product_ID = i.Product_ID
        ORDER BY p.Product_Name ASC";

$result = $conn->query($sql);

$products = [];

if ($result && $result->num_rows > 0) {
    while($row = $result->fetch_assoc()) {
        // Ensure numbers are numbers
        $row['price'] = (float)$row['price'];
        $row['stock'] = (int)$row['stock'];
        $row['reorder_level'] = (int)$row['reorder_level'];
        $products[] = $row;
    }
}

ob_clean();
echo json_encode($products);

$conn->close();
?>
