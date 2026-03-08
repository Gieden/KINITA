<?php
require 'db_connect.php';
$tables = [];
$q = $conn->query("SHOW TABLES");
if ($q) {
    while($r = $q->fetch_row()) {
        $tables[] = $r[0];
    }
}
echo "TABLES: " . implode(", ", $tables) . "\n";
if (in_array("EMPLOYEE", $tables)) echo "EMPLOYEE count: " . $conn->query("SELECT * FROM EMPLOYEE")->num_rows . "\n";
if (in_array("ACCOUNT", $tables)) echo "ACCOUNT count: " . $conn->query("SELECT * FROM ACCOUNT")->num_rows . "\n";
if (in_array("PRODUCT", $tables)) echo "PRODUCT count: " . $conn->query("SELECT * FROM PRODUCT")->num_rows . "\n";
if (in_array("INVENTORY", $tables)) echo "INVENTORY count: " . $conn->query("SELECT * FROM INVENTORY")->num_rows . "\n";
if (in_array("CATEGORY", $tables)) echo "CATEGORY count: " . $conn->query("SELECT * FROM CATEGORY")->num_rows . "\n";
?>
