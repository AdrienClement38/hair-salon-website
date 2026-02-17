<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Models\User;
use Src\Core\Database;
use PDO;

class UserController extends Controller
{
    private $userModel;
    private $pdo;

    public function __construct()
    {
        $this->userModel = new User();
        $this->pdo = Database::getInstance()->getConnection();
    }

    public function index()
    {
        // GET /api/users
        // Logic from api/users.php
        $id = $_GET['id'] ?? null;

        if ($id) {
            $user = $this->userModel->findById($id);
            if ($user) {
                // Ensure daysOff is parsed
                $user['daysOff'] = json_decode($user['days_off'] ?? '[]');
                $this->json($user);
            } else {
                $this->json(['error' => 'User not found'], 404);
            }
        } elseif (isset($_GET['me'])) {
            // Auth check needed here? ideally yes.
            if (!isset($_SESSION['user_id']))
                $this->json(['error' => 'Unauthorized'], 401);

            if ($_SESSION['user_id'] === 'admin') {
                // Super Admin Mock
                $this->json([
                    'id' => 'admin',
                    'username' => 'admin',
                    'display_name' => 'Super Admin',
                    'role' => 'admin',
                    'daysOff' => []
                ]);
            } else {
                $user = $this->userModel->findById($_SESSION['user_id']);
                if ($user) {
                    $user['daysOff'] = json_decode($user['days_off'] ?? '[]');
                    $this->json($user);
                } else {
                    $this->json(['error' => 'User not found'], 404);
                }
            }
        } else {
            // List all
            // Logic from getAllWorkers but for all users
            $stmt = $this->pdo->query("SELECT id, username, display_name, role, days_off FROM users ORDER BY display_name ASC");
            $users = $stmt->fetchAll();
            foreach ($users as &$u) {
                $u['daysOff'] = json_decode($u['days_off'] ?? '[]');
            }
            $this->json($users);
        }
    }

    // UPDATE, CREATE, DELETE methods...
    public function update()
    {
        $input = $this->getInput();
        $id = $_GET['id'] ?? $_SESSION['user_id'] ?? null;

        if (!$id)
            $this->json(['error' => 'ID required'], 400);

        // Fields to update
        $fields = [];
        $params = [];

        if (isset($input['username'])) {
            $fields[] = "username = ?";
            $params[] = $input['username'];
        }
        if (isset($input['displayName'])) {
            $fields[] = "display_name = ?";
            $params[] = $input['displayName'];
        }
        if (isset($input['password']) && !empty($input['password'])) {
            $fields[] = "password_hash = ?";
            $params[] = password_hash($input['password'], PASSWORD_DEFAULT);
        }
        if (isset($input['daysOff'])) {
            $fields[] = "days_off = ?";
            $params[] = json_encode($input['daysOff']);
        }

        if (empty($fields))
            $this->json(['error' => 'No fields to update'], 400);

        $params[] = $id;
        $sql = "UPDATE users SET " . implode(', ', $fields) . " WHERE id = ?";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $this->json(['success' => true]);
    }
}
