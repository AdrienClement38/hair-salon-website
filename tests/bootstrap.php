<?php
// tests/bootstrap.php

// Autoloader
spl_autoload_register(function ($class) {
    if (strpos($class, 'Src\\') === 0) {
        $prefix = 'Src\\';
        $base_dir = __DIR__ . '/../src/';
        $len = strlen($prefix);
        $relative_class = substr($class, $len);
        $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
        if (file_exists($file)) {
            require $file;
        }
    }
});

// Start Session Mock
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
