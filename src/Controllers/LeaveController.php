<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Models\Leave;

class LeaveController extends Controller
{
    private $leaveModel;

    public function __construct()
    {
        $this->leaveModel = new Leave();
    }

    public function index()
    {
        // GET /api/leaves?adminId=..&strict=..
        $adminId = $_GET['adminId'] ?? null;
        $strict = ($_GET['strict'] ?? 'false') === 'true'; // string to bool

        $leaves = $this->leaveModel->get($adminId, $strict);
        $this->json($leaves);
    }

    public function create()
    {
        // POST /api/leaves
        $input = $this->getInput();
        if (empty($input['start']) || empty($input['end'])) {
            $this->json(['error' => 'Dates required'], 400);
        }

        $id = $this->leaveModel->create(
            $input['start'],
            $input['end'],
            $input['adminId'] ?? null,
            $input['note'] ?? ''
        );

        $this->json(['success' => true, 'id' => $id]);
    }

    public function delete()
    {
        // DELETE /api/leaves?id=..
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'ID required'], 400);
        }

        $this->leaveModel->delete($id);
        $this->json(['success' => true]);
    }
}
