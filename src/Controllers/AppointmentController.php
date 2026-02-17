<?php
namespace Src\Controllers;

use Src\Core\Controller;
use Src\Models\Appointment;

class AppointmentController extends Controller
{
    private $appointmentModel;

    public function __construct()
    {
        $this->appointmentModel = new Appointment();
    }

    public function index()
    {
        // GET /api/appointments?start=...&end=...
        $start = $_GET['start'] ?? date('Y-m-d 00:00:00');
        $end = $_GET['end'] ?? date('Y-m-d 23:59:59');

        $appointments = $this->appointmentModel->getByDateRange($start, $end);
        $this->json($appointments);
    }

    public function create()
    {
        // POST /api/appointments
        $input = $this->getInput();

        // Basic Validation
        if (empty($input['clientName']) || empty($input['appointmentTime'])) {
            $this->json(['error' => 'Missing required fields'], 400);
        }

        try {
            $id = $this->appointmentModel->create($input);
            $this->json(['success' => true, 'id' => $id]);
        } catch (\Exception $e) {
            $this->json(['error' => $e->getMessage()], 500);
        }
    }

    public function delete()
    {
        // DELETE /api/appointments?id=...
        // Or POST with id? Router supports DELETE method.
        $id = $_GET['id'] ?? null;
        if (!$id) {
            $this->json(['error' => 'ID required'], 400);
        }

        if ($this->appointmentModel->delete($id)) {
            $this->json(['success' => true]);
        } else {
            $this->json(['error' => 'Failed to delete'], 500);
        }
    }
}
