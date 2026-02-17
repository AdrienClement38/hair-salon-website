<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Core\Database;
use PDO;

class AuthController extends Controller
{
    public function login()
    {
        $input = $this->getInput();
        $username = $input['username'] ?? '';
        $password = $input['password'] ?? '';

        if (!$username || !$password) {
            $this->json(['error' => 'Username and password required'], 400);
        }

        $pdo = Database::getInstance()->getConnection();

        // 1. Check Admin (Settings table)
        if ($username === 'admin') {
            $stmt = $pdo->prepare("SELECT value FROM settings WHERE name = 'admin_password'");
            $stmt->execute();
            $hash = $stmt->fetchColumn();

            if ($hash && password_verify($password, $hash)) {
                // Determine Admin ID (Assuming schema has id 1 for admin or we mock it)
                // Actually settings table doesn't have ID. Admin is special.
                // Let's check how users.php handled it.
                // Admin might have an entry in 'users' table or treated specially.
                // If users table exists, check there too?
                // For now, following logic from auth_login.php

                $_SESSION['user_id'] = 'admin';
                $_SESSION['role'] = 'admin';
                $this->json(['success' => true, 'role' => 'admin']);
            }
        }

        // 2. Check Workers (admins table)
        // Use User Model
        $userModel = new \Src\Models\User();
        $user = $userModel->findByUsername($username);

        if ($user && password_verify($password, $user['password_hash'])) {
            $_SESSION['user_id'] = $user['id'];
            $_SESSION['role'] = $user['role'];
            $this->json(['success' => true, 'role' => $user['role']]);
        }

        $this->json(['error' => 'Invalid credentials'], 401);
    }

    public function logout()
    {
        session_destroy();
        $this->json(['success' => true]);
    }

    public function status()
    {
        if (isset($_SESSION['user_id'])) {
            $this->json(['authenticated' => true, 'role' => $_SESSION['role'] ?? 'user']);
        } else {
            $this->json(['authenticated' => false]);
        }
    }
}
