<?php
namespace Src\Core;

class Controller
{
    protected function json($data, $status = 200)
    {
        http_response_code($status);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    protected function getInput()
    {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }
}
