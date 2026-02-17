<?php
require_once __DIR__ . '/../config/db.php';

// Override DB Name for setup
$test_db_name = 'salon_db_test';

try {
    // Connect to MySQL server (without selecting DB first)
    $dsn = "mysql:host=$db_host;port=$db_port;charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

    // Re-create Test DB
    $pdo->exec("DROP DATABASE IF EXISTS $test_db_name");
    $pdo->exec("CREATE DATABASE $test_db_name");
    $pdo->exec("USE $test_db_name");

    // Import Schema
    $sql = file_get_contents(__DIR__ . '/../database.sql');

    // Split by semicolon (rough split, but works for simple dumps)
    // database.sql might have delimiters, but standard dump usually uses ;
    // This is a simple runner.
    $statements = explode(';', $sql);
    foreach ($statements as $statement) {
        $statement = trim($statement);
        if ($statement) {
            $pdo->exec($statement);
        }
    }

    // Seed Data
    $pass = password_hash('password', PASSWORD_DEFAULT);
    $pdo->exec("INSERT INTO admins (username, password_hash, role) VALUES ('testuser', '$pass', 'worker')");
    $pdo->exec("INSERT INTO settings (`key`, `value`) VALUES ('admin_password', '$pass')"); // Super Admin

    echo "Test Database '$test_db_name' setup complete.\n";

} catch (PDOException $e) {
    die("DB Setup Failed: " . $e->getMessage() . "\n");
}
