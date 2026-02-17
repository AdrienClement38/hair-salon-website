<?php
namespace Src\Models;

use Src\Core\Database;
use PDO;

class Leave
{
    private $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function get($adminId = null, $strict = false)
    {
        $sql = "SELECT * FROM leaves WHERE 1=1";
        $params = [];

        if ($adminId !== null && $adminId !== 'null' && $adminId !== '') {
            if ($strict) {
                $sql .= " AND admin_id = ?";
                $params[] = $adminId;
            } else {
                $sql .= " AND (admin_id = ? OR admin_id IS NULL)";
                $params[] = $adminId;
            }
        } else {
            if ($strict) {
                $sql .= " AND admin_id IS NULL";
            }
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function create($start, $end, $adminId, $note)
    {
        $stmt = $this->pdo->prepare("INSERT INTO leaves (start_date, end_date, admin_id, note) VALUES (?, ?, ?, ?)");
        $stmt->execute([$start, $end, $adminId, $note]);
        return $this->pdo->lastInsertId();
    }

    public function delete($id)
    {
        $stmt = $this->pdo->prepare("DELETE FROM leaves WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
