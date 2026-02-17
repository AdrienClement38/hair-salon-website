<?php
namespace Src\Models;

use Src\Core\Database;
use PDO;

class WaitingList
{
    private $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function getCounts($date)
    {
        $stmt = $this->pdo->prepare("
            SELECT desired_worker_id, COUNT(*) as count 
            FROM waiting_list_requests 
            WHERE target_date = ? AND status = 'WAITING'
            GROUP BY desired_worker_id
        ");
        $stmt->execute([$date]);
        return $stmt->fetchAll();
    }

    // Add other methods (create request, etc.) as needed
}
