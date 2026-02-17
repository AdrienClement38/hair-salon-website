<?php
namespace Src\Models;

use Src\Core\Database;
use PDO;

class Appointment
{
    private $pdo;

    public function __construct()
    {
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function getByDateRange($start, $end)
    {
        $stmt = $this->pdo->prepare("
            SELECT * FROM appointments 
            WHERE appointment_time BETWEEN ? AND ?
        ");
        $stmt->execute([$start, $end]);
        return $stmt->fetchAll();
    }

    public function create($data)
    {
        $stmt = $this->pdo->prepare("
            INSERT INTO appointments (client_name, appointment_time, duration, service, worker_id)
            VALUES (?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            $data['clientName'],
            $data['appointmentTime'], // format: YYYY-MM-DD HH:MM:SS
            $data['duration'],
            $data['service'],
            $data['workerId']
        ]);
        return $this->pdo->lastInsertId();
    }

    public function delete($id)
    {
        $stmt = $this->pdo->prepare("DELETE FROM appointments WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
