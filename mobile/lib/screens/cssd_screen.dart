import 'package:flutter/material';

class CSSDScreen extends StatefulWidget {
  const CSSDScreen({super.key});

  @override
  State<CSSDScreen> createState() => _CSSDScreenState();
}

class _CSSDScreenState extends State<CSSDScreen> {
  String _autoclaveStatus = 'Idle';
  double _progress = 0.0;

  void _startSterilization() {
    setState(() {
      _autoclaveStatus = 'Sterilizing Pack Set...';
      _progress = 0.1;
    });

    // Simulate progress updates
    Future.delayed(const Duration(seconds: 1), () {
      if (mounted) setState(() => _progress = 0.5);
    });
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _progress = 1.0;
          _autoclaveStatus = 'Sterilization Complete (Sterile)';
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('CSSD Instrument Pack is now Sterile and Available')),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Autoclave Cycle Simulator'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.science, color: Colors.blue),
                        SizedBox(width: 12),
                        Text('Autoclave Station #01', style: TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    const Divider(height: 24),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.between,
                      children: [
                        const Text('Cycle Status:'),
                        Text(_autoclaveStatus, style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
                      ],
                    ),
                    const SizedBox(height: 16),
                    LinearProgressIndicator(value: _progress),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Sterilizer Control Actions',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: _progress > 0 && _progress < 1.0 ? null : _startSterilization,
              icon: const Icon(Icons.play_arrow),
              label: const Text('Start 134°C Autoclave Cycle'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(48),
                backgroundColor: const Color(0xFF0E8DE3),
                foregroundColor: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
