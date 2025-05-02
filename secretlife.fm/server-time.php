<?php
// Set headers to allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");

// Return current server time in JSON format
echo json_encode([
    'datetime' => date('c'), // ISO 8601 date
    'unixtime' => time()     // Unix timestamp
]);
?>
