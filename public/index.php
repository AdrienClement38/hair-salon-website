<?php
// public/index.php

// 1. Session Start (Secure)
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 86400 * 7,
        'path' => '/',
        'domain' => '',
        'secure' => isset($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Strict'
    ]);
    session_start();
}

// 2. Autoloader
spl_autoload_register(function ($class) {
    $prefix = 'Src\\';
    $base_dir = __DIR__ . '/../src/';
    $len = strlen($prefix);

    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relative_class = substr($class, $len);
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

// 3. Router Setup
use Src\Core\Router;
use Src\Controllers\AuthController;
// Add other controllers as needed

$router = new Router();

// API Routes - Auth
$router->post('/api/auth/login', [AuthController::class, 'login']);
$router->post('/api/auth/logout', [AuthController::class, 'logout']);
$router->get('/api/auth/status', [AuthController::class, 'status']);

// API Routes - Appointments
use Src\Controllers\AppointmentController;
$router->get('/api/appointments', [AppointmentController::class, 'index']);
$router->post('/api/appointments', [AppointmentController::class, 'create']);
$router->delete('/api/appointments', [AppointmentController::class, 'delete']);

// API Routes - Settings
use Src\Controllers\SettingsController;
$router->get('/api/settings', [SettingsController::class, 'index']);
$router->post('/api/settings', [SettingsController::class, 'update']);
$router->post('/api/settings/test-email', [SettingsController::class, 'testEmail']);

// API Routes - Upload
use Src\Controllers\UploadController;
$router->post('/api/upload', [UploadController::class, 'upload']);

// API Routes - Users
use Src\Controllers\UserController;
$router->get('/api/users', [UserController::class, 'index']);
$router->put('/api/users', [UserController::class, 'update']);
// Add POST/DELETE if needed for Admin

// API Routes - Leaves
use Src\Controllers\LeaveController;
$router->get('/api/leaves', [LeaveController::class, 'index']);
$router->post('/api/leaves', [LeaveController::class, 'create']);
$router->delete('/api/leaves', [LeaveController::class, 'delete']);

// API Routes - Waiting List
use Src\Controllers\WaitingListController;
$router->get('/api/waiting-list', [WaitingListController::class, 'index']);

// Dispatch
$uri = $_SERVER['REQUEST_URI'];
$method = $_SERVER['REQUEST_METHOD'];

// Simple strip for public folder if needed
if (strpos($uri, '/public') === 0) {
    $uri = substr($uri, 7);
}

// Remove query string from URI for matching
if (false !== $pos = strpos($uri, '?')) {
    $uri = substr($uri, 0, $pos);
}

$router->dispatch($uri, $method);
