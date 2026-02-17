<?php
namespace Src\Controllers;

use Src\Core\Controller;

class UploadController extends Controller
{
    public function upload()
    {
        // POST /api/upload
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->json(['error' => 'Method not allowed'], 405);
        }

        $uploadDir = __DIR__ . '/../../public/uploads/';
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        // Handle file
        // Helper to find file in $_FILES
        $file = $_FILES['image'] ?? $_FILES['file'] ?? (count($_FILES) > 0 ? reset($_FILES) : null);

        if (!$file || $file['error'] !== UPLOAD_ERR_OK) {
            $this->json(['error' => 'No file uploaded or upload error'], 400);
        }

        // Validate Type
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']);
        $allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

        if (!in_array($mime, $allowed)) {
            $this->json(['error' => 'Invalid file type'], 400);
        }

        // Generate Name
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid('img_') . '.' . $ext;
        $target = $uploadDir . $filename;

        if (move_uploaded_file($file['tmp_name'], $target)) {
            // Return filename and relative path
            $this->json([
                'success' => true,
                'filename' => $filename,
                'path' => 'uploads/' . $filename
            ]);
        } else {
            $this->json(['error' => 'Failed to save file'], 500);
        }
    }
}
