<?php
// test_api.php

function call_api($params) {
    $url = "http://localhost:8000/api/get_transactions.php?" . http_build_query($params);
    echo "Calling: $url\n";
    $response = file_get_contents($url);
    echo "Response: " . substr($response, 0, 500) . "...\n\n"; // Truncate output
    return json_decode($response, true);
}

echo "Testing Sales Transaction API...\n";
call_api(['type' => 'sale', 'limit' => 5]);

echo "Testing Restock Transaction API...\n";
call_api(['type' => 'restock', 'limit' => 5]);

echo "Testing Search API...\n";
call_api(['type' => 'sale', 'search' => 'Giel']);

?>
