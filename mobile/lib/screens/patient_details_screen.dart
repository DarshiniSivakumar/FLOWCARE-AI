import 'package:flutter/material';

class PatientDetailsScreen extends StatefulWidget {
  final String name;
  final String code;
  final String urgency;

  const PatientDetailsScreen({
    super.key,
    required this.name,
    required this.code,
    required this.urgency,
  });

  @override
  State<PatientDetailsScreen> createState() => _PatientDetailsScreenState();
}

class _PatientDetailsScreenState extends State<PatientDetailsScreen> {
  int _readinessScore = 55;
  String _location = 'Ward A';

  void _triggerEvent(String eventName, String newLocation, int newScore) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Triggered event: $eventName')),
    );
    setState(() {
      _location = newLocation;
      _readinessScore = newScore;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.name),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Details Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        Text('Patient Code: ${widget.code}', style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text('Urgency: ${widget.urgency}', style: TextStyle(color: widget.urgency == 'CRITICAL' ? Colors.red : Colors.orange)),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Current Location:'),
                        Text(_location, style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Readiness Score:'),
                        Text('$_readinessScore%', style: TextStyle(fontWeight: FontWeight.bold, color: _readinessScore >= 80 ? Colors.green : Colors.red)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Workflow Actions',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => _triggerEvent('PATIENT_READY', 'Ward A (Ready)', 85),
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: const Text('Confirm Patient Prep & Ready'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => _triggerEvent('TRANSFER_STARTED', 'Transfer Corridor', 90),
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: const Text('Initiate Ward Transfer'),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => _triggerEvent('PATIENT_ARRIVED_OT', 'OT Block', 100),
              style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              child: const Text('Confirm OT Arrival'),
            ),
          ],
        ),
      ),
    );
  }
}
