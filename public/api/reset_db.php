<?php
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: POST");

include_once 'db_connect.php';

// Output buffering
ob_start();

$response = ["status" => "error", "message" => "Unknown error"];

try {
    // 1. Drop Database
    // We need a raw connection first to drop the DB
    $connRaw = new mysqli($host, $user, $pass);
    if ($connRaw->connect_error) {
        throw new Exception("Connection failed: " . $connRaw->connect_error);
    }
    
    $connRaw->query("DROP DATABASE IF EXISTS $db");
    $connRaw->close();
    
    // 2. Re-create and Init using init_db logic
    // We can actually just instantiate a new connection and run setup.sql
    // But setup.sql includes CREATE DATABASE if not exists
    
    $conn = new mysqli($host, $user, $pass);
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    $sqlFile = '../../database/setup.sql';
    if (!file_exists($sqlFile)) {
        throw new Exception("setup.sql file not found");
    }

    $sql = file_get_contents($sqlFile);

    if ($conn->multi_query($sql)) {
         do {
            if ($res = $conn->store_result()) {
                $res->free();
            }
        } while ($conn->more_results() && $conn->next_result());
        
        $response = ["status" => "success", "message" => "Database reset successfully."];
    } else {
        throw new Exception("Error executing SQL: " . $conn->error);
    }
    
    $conn->close();

} catch (Exception $e) {
    if (isset($conn)) $conn->close();
    if (isset($connRaw)) $connRaw->close();
    $response = ["status" => "error", "message" => $e->getMessage()];
}

ob_end_clean();
echo json_encode($response);
