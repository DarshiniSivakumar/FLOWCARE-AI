import 'package:flutter/material';
import 'tasks_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;

  void _handleLogin(String role, String email) {
    setState(() => _loading = true);
    // Simulate API delay
    Future.delayed(const Duration(milliseconds: 800), () {
      setState(() => _loading = false);
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => TasksScreen(role: role, email: email),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    
    return Scaffold(
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.stethoscope, size: 64, color: Color(0xFF0E8DE3)),
              const SizedBox(height: 16),
              Text(
                'FlowCare AI Mobile',
                style: theme.textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Logistical Workflow Engine',
                style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey),
              ),
              const SizedBox(height: 32),
              
              TextField(
                controller: _emailController,
                decoration: const InputDecoration(
                  labelText: 'Email',
                  prefixIcon: Icon(Icons.email),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  prefixIcon: Icon(Icons.lock),
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 24),
              
              ElevatedButton(
                onPressed: _loading ? null : () => _handleLogin('NURSE', 'nurse@flowcare.demo'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size.fromHeight(50),
                  backgroundColor: const Color(0xFF0E8DE3),
                  foregroundColor: Colors.white,
                ),
                child: _loading 
                  ? const CircularProgressIndicator(color: Colors.white) 
                  : const Text('Sign In'),
              ),
              const SizedBox(height: 32),
              
              const Text('Quick Demo logins', style: TextStyle(color: Colors.grey, fontSize: 12)),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  ActionChip(
                    label: const Text('Nurse Panel'),
                    onPressed: () => _handleLogin('NURSE', 'nurse@flowcare.demo'),
                  ),
                  ActionChip(
                    label: const Text('CSSD Tech'),
                    onPressed: () => _handleLogin('CSSD_STAFF', 'cssd@flowcare.demo'),
                  ),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}
