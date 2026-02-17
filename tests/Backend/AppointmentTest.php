<?php
use PHPUnit\Framework\TestCase;
use Src\Controllers\AppointmentController;
use Src\Models\Appointment;

class AppointmentTest extends TestCase
{

    public function testCreateAppointment()
    {
        $controller = new class extends AppointmentController {
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
            }
        };

        $data = [
            'clientName' => 'John Doe',
            'appointmentTime' => date('Y-m-d H:i:s', strtotime('+1 day')), // Future date
            'duration' => 60,
            'service' => 'Haircut',
            'workerId' => 1 // Assuming ID 1 exists (testuser?)
        ];

        $controller->setInput($data);

        ob_start();
        $controller->create();
        $output = ob_get_clean();

        $res = json_decode($output, true);
        $this->assertTrue($res['success']);
        $this->assertArrayHasKey('id', $res);
    }

    // Add slot calculation test if logic was moved to Model
    // Currently slot calc seems to be purely frontend or basic query?
    // User asked: "Teste le Login, la Création de rdv, et le calcul des slots disponibles."
    // Slot calculation logic needs to be in Backend to be tested.
    // Let's implement calculateSlots in AppointmentController or similar.
}
