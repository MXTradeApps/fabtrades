import 'package:material_ui/material_ui.dart';

import 'account_section.dart';
import 'delete_account_section.dart';
import 'subscription_section.dart';

/// Dedicated account page: who is signed in, sync, and subscription.
class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('My Account')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          AccountSection(),
          SubscriptionSection(),
          DeleteAccountSection(),
        ],
      ),
    );
  }
}
