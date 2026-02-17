<?php
namespace Src\Models;

use Src\Core\Database;
use PDO;

class User
{
    private $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function findByUsername($username)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM admins WHERE username = ?");
        $stmt->execute([$username]);
        return $stmt->fetch();
    }

    public function findById($id)
    {
        $stmt = $this->pdo->prepare("SELECT * FROM admins WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public function getAllWorkers($activeOnly = false)
    {
        $sql = "SELECT id, username, display_name, role, days_off, photo FROM admins WHERE role != 'admin'";
        // Assuming 'admin' role is filtered out or handled differently?
        // Original code in workers_list.php filtered via check? No, it just dumped users.
        // users.php logic: fetching all.

        $stmt = $this->pdo->query($sql);
        return $stmt->fetchAll();
    }

    // Add update, create methods as needed for users.php logic
}
