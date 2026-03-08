<?php
// debug.php
header("Access-Control-Allow-Origin: *");
header("Content-Type: text/html");

echo "<h1>Kinita System Diagnostic</h1>";
echo "<hr>";

// 1. Check PHP Version
echo "<h3>1. PHP Version</h3>";
echo "PHP Version: " . phpversion() . "<br>";
echo "MySQLi Extension: " . (extension_loaded('mysqli') ? "<span style='color:green'>Installed</span>" : "<span style='color:red'>MISSING</span>") . "<br>";

// 2. Check Connection (Localhost)
echo "<h3>2. Connection Test (localhost)</h3>";
try {
    $conn = @new mysqli("localhost", "root", "");
    if ($conn->connect_error) {
        echo "Status: <span style='color:red'>FAILED</span><br>";
        echo "Error: " . $conn->connect_error . "<br>";
    } else {
        echo "Status: <span style='color:green'>SUCCESS</span><br>";
        echo "Host Info: " . $conn->host_info . "<br>";
        $conn->close();
    }
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "<br>";
}

// 3. Check Connection (127.0.0.1)
echo "<h3>3. Connection Test (127.0.0.1)</h3>";
try {
    $conn = @new mysqli("127.0.0.1", "root", "");
    if ($conn->connect_error) {
        echo "Status: <span style='color:red'>FAILED</span><br>";
        echo "Error: " . $conn->connect_error . "<br>";
    } else {
        echo "Status: <span style='color:green'>SUCCESS</span><br>";
        echo "Host Info: " . $conn->host_info . "<br>";
        
        // Check DB
        if ($conn->select_db("kinita_db")) {
            echo "Database 'kinita_db': <span style='color:green'>FOUND</span><br>";
            
            $res = $conn->query("SHOW TABLES");
            echo "Tables found: " . $res->num_rows . "<br>";
            while($row = $res->fetch_array()) {
                echo "- " . $row[0] . "<br>";
            }
        } else {
            echo "Database 'kinita_db': <span style='color:red'>NOT FOUND</span><br>";
        }
        $conn->close();
    }
} catch (Exception $e) {
    echo "Exception: " . $e->getMessage() . "<br>";
}
?>
