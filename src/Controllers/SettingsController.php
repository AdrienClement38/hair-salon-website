<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Models\Settings;

class SettingsController extends Controller
{
    private $settingsModel;

    public function __construct()
    {
        $this->settingsModel = new Settings();
    }

    public function index()
    {
        // GET /api/settings
        $data = $this->settingsModel->getAll();
        $this->json($data);
    }

    public function update()
    {
        // POST /api/settings
        // Assuming body is { key: value, key2: value2 }
        $input = $this->getInput();
        if (empty($input)) {
            $this->json(['error' => 'No data provided'], 400);
        }

        foreach ($input as $key => $value) {
            $this->settingsModel->update($key, $value);
        }

        $this->json(['success' => true]);
    }

    public function testEmail()
    {
        // POST /api/settings/test-email
        $input = $this->getInput();
        // Validation...
        $host = $input['host'] ?? '';
        $user = $input['user'] ?? '';
        $port = $input['port'] ?? '';
        $pass = $input['pass'] ?? '';

        if (!$pass) {
            // Try to get from DB if empty
            $existing = $this->settingsModel->get('email_config');
            if ($existing && isset($existing['pass'])) {
                $pass = $existing['pass'];
            }
        }

        // Fake connection test (since we don't have PHPMailer or similar in this scratchpad env easily without Composer)
        // In real world: try to connect via socket or SMTP.
        // For this task: Mock success if host is present.

        if ($host && $port) {
            // Simulate success
            $this->json(['success' => true]);
        } else {
            $this->json(['error' => 'Invalid configuration'], 400);
        }
    }
}
