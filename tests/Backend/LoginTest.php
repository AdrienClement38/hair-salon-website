<?php
use PHPUnit\Framework\TestCase;
use Src\Controllers\AuthController;

class LoginTest extends TestCase
{

    public static function setUpBeforeClass(): void
    {
        // Run specific DB setup or rely on global setup
        require_once __DIR__ . '/../setup_test_db.php';
    }

    protected function setUp(): void
    {
        // Reset session
        if (session_status() === PHP_SESSION_ACTIVE) {
            session_unset();
        }
        $_SESSION = [];
    }

    public function testLoginSuccessWorker()
    {
        $_SERVER['REQUEST_METHOD'] = 'POST';

        // Mock Input via a helper or by modifying global input stream if wrappers support it
        // Since Controller::getInput reads php://input, we can't easily mock it without vfsStream or similar.
        // Alternative: Refactor Controller to allow setInput.

        // Let's use a specialized TestController that extends AuthController and overrides getInput
        $controller = new class extends AuthController {
            public function setInput($data)
            {
                $this->input = $data;
            }
            protected function getInput()
            {
                return $this->input;
            }
            protected function json($data, $status = 200)
            {
                echo json_encode($data);
            } // Suppress exit
        };

        $controller->setInput(['username' => 'testuser', 'password' => 'password']);

        ob_start();
        $controller->login();
        $output = ob_get_clean();

        $data = json_decode($output, true);
        $this->assertTrue($data['success']);
        $this->assertEquals('worker', $data['role']);
        $this->assertEquals('worker', $_SESSION['role']);
    }

    public function testLoginFailure()
    {
        $controller = new class extends AuthController {
            public function setInput($data)
            {
                $this->input = $data;
            }
            protected function getInput()
            {
                return $this->input;
            }
            protected function json($data, $status = 200)
            {
                echo json_encode($data);
                http_response_code($status);
            }
        };

        $controller->setInput(['username' => 'testuser', 'password' => 'wrong']);

        ob_start();
        $controller->login();
        ob_end_clean();

        // Check status code - difficult with standard PHPUnit in same process
        // But we can check output or session not set
        $this->assertEmpty($_SESSION);
    }
}
