import 'package:flutter/material';
import 'patient_details_screen.dart';
import 'cssd_screen.dart';

class TasksScreen extends StatelessWidget {
  final String role;
  final String email;

  const TasksScreen({super.key, required this.role, required this.email});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isNurse = role == 'NURSE';

    return Scaffold(
      appBar: AppBar(
        title: Text(isNurse ? 'Nurse Workflow Tasks' : 'CSSD Supply Status'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () {
              Navigator.pop(context);
            },
          )
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Header card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  children: [
                    CircleAvatar(
                      backgroundColor: theme.colorScheme.primary.withOpacity(0.1),
                      child: Icon(Icons.person, color: theme.colorScheme.primary),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          role == 'NURSE' ? 'Nurse coordinator' : 'CSSD Technician',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(email, style: const TextStyle(color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Active Worklists',
              style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            Expanded(
              child: isNurse ? _buildNurseTasks(context) : _buildCSSDTasks(context),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildNurseTasks(BuildContext context) {
    final tasks = [
      {'patient': 'Robert Davis', 'code': 'P102', 'status': 'Prep Stage', 'urgency': 'CRITICAL'},
      {'patient': 'Margaret Wilson', 'code': 'P115', 'status': 'Scheduled', 'urgency': 'HIGH'},
      {'patient': 'David Brown', 'code': 'P121', 'status': 'Transit Ward', 'urgency': 'MEDIUM'},
    ];

    return ListView.builder(
      itemCount: tasks.length,
      itemBuilder: (context, index) {
        final t = tasks[index];
        final isCritical = t['urgency'] == 'CRITICAL';
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: Icon(
              Icons.warning,
              color: isCritical ? Colors.red : Colors.orange,
            ),
            title: Text(t['patient']!),
            subtitle: Text('ID: ${t['code']} | Status: ${t['status']}'),
            trailing: const Icon(Icons.chevron_right),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => PatientDetailsScreen(
                    name: t['patient']!,
                    code: t['code']!,
                    urgency: t['urgency']!,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildCSSDTasks(BuildContext context) {
    final packs = [
      {'type': 'Laparoscopic Set', 'status': 'CLEANING', 'warnings': 'Shortage Alert'},
      {'type': 'General Surgery Set', 'status': 'STERILE', 'warnings': 'OK'},
      {'type': 'Orthopedic Set', 'status': 'STERILE', 'warnings': 'OK'},
    ];

    return Column(
      children: [
        ElevatedButton.icon(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (context) => const CSSDScreen()),
            );
          },
          icon: const Icon(Icons.science),
          label: const Text('Manage Sterilization Cycles'),
          style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
        ),
        const SizedBox(height: 16),
        Expanded(
          child: ListView.builder(
            itemCount: packs.length,
            itemBuilder: (context, index) {
              final p = packs[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                child: ListTile(
                  leading: const Icon(Icons.inventory_2),
                  title: Text(p['type']!),
                  subtitle: Text('Status: ${p['status']}'),
                  trailing: Text(
                    p['warnings']!,
                    style: TextStyle(
                      color: p['warnings'] != 'OK' ? Colors.red : Colors.green,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
