<?php
// Set headers to allow cross-origin requests
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type");

// File to store active listeners
$listenersFile = 'active_listeners.json';

// Check if directory is writable
if (!is_writable(dirname($listenersFile))) {
    http_response_code(500);
    die(json_encode(['error' => 'Directory not writable', 'count' => 0]));
}

// Initialize listeners array
$activeListeners = [];

// Load existing data if file exists
if (file_exists($listenersFile)) {
    $jsonData = file_get_contents($listenersFile);
    if ($jsonData === false) {
        http_response_code(500);
        die(json_encode(['error' => 'Could not read listeners file', 'count' => 0]));
    }
    $activeListeners = json_decode($jsonData, true) ?: [];
}

// Clean up old entries (older than 2 minutes)
$now = time();
foreach ($activeListeners as $id => $timestamp) {
    if ($now - $timestamp > 120) { // 2 minutes
        unset($activeListeners[$id]);
    }
}

// Process incoming request
$requestData = json_decode(file_get_contents('php://input'), true);

if (isset($requestData['sessionId'])) {
    $sessionId = $requestData['sessionId'];
    
    if (isset($requestData['action']) && $requestData['action'] === 'leave') {
        // Remove listener
        if (isset($activeListeners[$sessionId])) {
            unset($activeListeners[$sessionId]);
        }
    } else {
        // Add or update listener
        $activeListeners[$sessionId] = $now;
    }
    
    // Save updated list with error handling
    $result = file_put_contents($listenersFile, json_encode($activeListeners));
    if ($result === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Could not write to file', 'count' => count($activeListeners)]);
    } else {
        // Return current count
        echo json_encode(['count' => count($activeListeners), 'status' => 'success']);
    }
} else {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid request']);
}
?>
