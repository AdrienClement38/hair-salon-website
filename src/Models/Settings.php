<?php
namespace Src\Models;

use Src\Core\Database;
use PDO;

class Settings
{
    private $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function getAll()
    {
        $stmt = $this->pdo->query("SELECT * FROM settings");
        $results = $stmt->fetchAll();
        $settings = [];
        foreach ($results as $row) {
            $val = $row['value'];
            // Attempt JSON decode
            $decoded = json_decode($val, true);
            $settings[$row['name']] = (json_last_error() === JSON_ERROR_NONE) ? $decoded : $val;
        }
        return $settings;
    }

    public function update($key, $value)
    {
        $valStr = is_string($value) ? $value : json_encode($value);
        $stmt = $this->pdo->prepare("INSERT INTO settings (name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)");
        return $stmt->execute([$key, $valStr]);
    }

    public function get($key)
    {
        $stmt = $this->pdo->prepare("SELECT value FROM settings WHERE name = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        if ($val === false)
            return null;
        $decoded = json_decode($val, true);
        return (json_last_error() === JSON_ERROR_NONE) ? $decoded : $val;
    }
}
