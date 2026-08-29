import 'package:flutter/material';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'screens/login_screen.dart';

void main() {
  runApp(
    const ProviderScope(
      child: FlowCareApp(),
    ),
  );
}

class FlowCareApp extends StatelessWidget {
  const FlowCareApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'FlowCare AI',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0E8DE3),
          brightness: Brightness.dark,
          background: const Color(0xFF0B1220),
          surface: const Color(0xFF0F172A),
        ),
        useMaterial3: true,
      ),
      home: const LoginScreen(),
    );
  }
}
