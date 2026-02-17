<?php
// config/db.php

// Load Env Vars if .env exists (Optional helper, otherwise use system env)
// For OVH, variables are usually set in environment or hardcoded here
// We will look for environment variables first, then fallback to constants

$db_host = getenv('DB_HOST') ?: 'localhost';
$db_name = getenv('DB_NAME') ?: 'salon_db';
$db_user = getenv('DB_USER') ?: 'root';
$db_pass = getenv('DB_PASS') ?: '';
$db_port = getenv('DB_PORT') ?: '3306';

try {
    $dsn = "mysql:host=$db_host;port=$db_port;dbname=$db_name;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    $pdo = new PDO($dsn, $db_user, $db_pass, $options);
} catch (\PDOException $e) {
    // In production, log error and show generic message
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Global Headers for JSON API
header('Content-Type: application/json; charset=utf-8');

// Start Session Securely (Strict, HttpOnly, Secure if HTTPS)
// We only start session if not active
if (session_status() === PHP_SESSION_NONE) {
    // Set secure params before starting
    $cookieParams = [
        'lifetime' => 86400 * 7, // 1 week
        'path' => '/',
        'domain' => '', // Current domain
        'secure' => isset($_SERVER['HTTPS']), // True if HTTPS
        'httponly' => true, // Script cannot access cookie
        'samesite' => 'Strict'
    ];
    session_set_cookie_params($cookieParams);
    session_start();
}
