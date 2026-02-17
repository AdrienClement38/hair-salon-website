<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Models\WaitingList;

class WaitingListController extends Controller
{
    private $waitingListModel;

    public function __construct()
    {
        $this->waitingListModel = new WaitingList();
    }

    public function index()
    {
        // GET /api/waiting-list?action=counts&date=...
        $action = $_GET['action'] ?? null;
        $date = $_GET['date'] ?? null;

        if ($action === 'counts' && $date) {
            $counts = $this->waitingListModel->getCounts($date);
            $this->json($counts);
        }

        // Handle other actions or list all
        $this->json([]);
    }
}
