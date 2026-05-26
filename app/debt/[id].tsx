import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  X, DollarSign, Share2, Clock, CheckCircle2,
  AlertTriangle, User, Calendar, Activity as ActivityIcon,
  Circle, Bell, BellOff, Ban, Archive, Trash2,
} from 'lucide-react-native';
import { useApp } from '../../src/store';
import { Colors, Spacing, BorderRadius, Shadows } from '../../src/theme';
import { getReminderMessage, getWhatsAppMessage } from '../../src/reminders';
import { openWhatsApp } from '../../src/whatsapp';

let NotificationsModule: any = null;
function getNotifications(): any {
  if (!NotificationsModule) {
    try {
      NotificationsModule = require('expo-notifications');
    } catch {
      // fallback
    }
    if (!NotificationsModule || typeof NotificationsModule !== 'object') {
      NotificationsModule = {};
    }
  }
  return NotificationsModule;
}

function formatCurrency(amount: number): string {
  return `M ${amount.toLocaleString()}`;
}

function formatDateDisplay(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function scheduleReminder(
  transactionId: string,
  debtorName: string,
  dueDate: string,
  amount: number,
  sender: string
) {
  try {
    const due = new Date(dueDate);
    const dayBefore = new Date(due);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(9, 0, 0, 0);

    const dayAfter = new Date(due);
    dayAfter.setDate(dayAfter.getDate() + 1);
    dayAfter.setHours(9, 0, 0, 0);

    const now = new Date();
    const fmt = (n: number) => n.toLocaleString();
    const dateStr = due.toLocaleDateString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

    if (dayBefore > now) {
      const body = getReminderMessage('before_due', {
        name: debtorName, amount: fmt(amount), date: dateStr, sender,
      });
      const Notif = getNotifications();
      if (Notif.scheduleNotificationAsync) {
        await Notif.scheduleNotificationAsync({
          identifier: `reminder_before_${transactionId}`,
          content: { title: 'Debt Reminder', body, data: { transactionId } },
          trigger: { date: dayBefore },
        });
      }
    }

    if (dayAfter > now) {
      const body = getReminderMessage('overdue', {
        name: debtorName, amount: fmt(amount), date: dateStr, sender,
      });
      const Notif = getNotifications();
      if (Notif.scheduleNotificationAsync) {
        await Notif.scheduleNotificationAsync({
          identifier: `reminder_after_${transactionId}`,
          content: { title: 'Payment Follow-Up', body, data: { transactionId } },
          trigger: { date: dayAfter },
        });
      }
    }
  } catch {}
}

export default function DebtDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    state, getContact, getActivity, getLineItems,
    makePayment, markBadDebt, archiveDebt, payInstallment,
    deleteTransaction,
  } = useApp();

  const transaction = state.transactions.find((t) => t.id === id);
  const contact = transaction ? getContact(transaction.contactId) : undefined;
  const activity = transaction ? getActivity(transaction.activityId) : undefined;
  const lineItems = transaction ? getLineItems(transaction.id) : [];

  const [showPaymentInput, setShowPaymentInput] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [remindersScheduled, setRemindersScheduled] = useState(false);

  useEffect(() => {
    (async () => {
      const Notif = getNotifications();
      if (!Notif.getAllScheduledNotificationsAsync) return;
      try {
        const scheduled = await Notif.getAllScheduledNotificationsAsync();
        const hasReminder = scheduled.some(
          (n: any) =>
            n.identifier === `reminder_before_${id}` ||
            n.identifier === `reminder_after_${id}`
        );
        setRemindersScheduled(hasReminder);
      } catch {}
    })();
  }, [id]);

  useEffect(() => {
    const Notif = getNotifications();
    if (Notif.requestPermissionsAsync) {
      Notif.requestPermissionsAsync().catch(() => {});
    }
  }, []);

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X size={24} stroke={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Not Found</Text>
          <View style={styles.closeBtn} />
        </View>
      </SafeAreaView>
    );
  }

  const statusColor =
    transaction.status === 'OVERDUE'
      ? Colors.red
      : transaction.status === 'GRACE'
        ? Colors.orange
        : Colors.green;

  const statusBg =
    transaction.status === 'OVERDUE'
      ? Colors.redLight
      : transaction.status === 'GRACE'
        ? Colors.orangeLight
        : Colors.greenLight;

  const StatusIcon =
    transaction.status === 'OVERDUE'
      ? AlertTriangle
      : transaction.status === 'GRACE'
        ? Clock
        : CheckCircle2;

  const statusLabel =
    transaction.status === 'OVERDUE'
      ? 'Overdue'
      : transaction.status === 'GRACE'
        ? 'Grace Period'
        : 'Paid';

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid', 'Enter a valid payment amount.');
      return;
    }
    if (amount > transaction.remainingBalance) {
      Alert.alert(
        'Exceeds Balance',
        `The remaining balance is ${formatCurrency(transaction.remainingBalance)}. You can pay up to that amount.`
      );
      return;
    }
    makePayment(transaction.id, amount);
    setShowPaymentInput(false);
    setPaymentAmount('');
    Alert.alert('Payment Recorded', `Payment of ${formatCurrency(amount)} has been logged.`);
  };

  const handleScheduleReminders = async () => {
    try {
      const debtorName = contact?.name || 'Customer';
      await scheduleReminder(
        transaction.id,
        debtorName,
        transaction.dueDate,
        transaction.remainingBalance,
        'KTIDEBT'
      );
      setRemindersScheduled(true);
      Alert.alert(
        'Reminders Set',
        'You will be notified 1 day before and 1 day after the due date.'
      );
    } catch {}
  };

  const handleCancelReminders = async () => {
    const Notif = getNotifications();
    if (!Notif.getAllScheduledNotificationsAsync) return;
    try {
      const scheduled = await Notif.getAllScheduledNotificationsAsync();
      const toRemove = scheduled.filter(
        (n: any) =>
          n.identifier === `reminder_before_${transaction.id}` ||
          n.identifier === `reminder_after_${transaction.id}`
      );
      for (const n of toRemove) {
        await Notif.cancelScheduledNotificationAsync(n.identifier);
      }
      setRemindersScheduled(false);
      Alert.alert('Cancelled', 'Reminders have been cancelled.');
    } catch {}
  };

  const handleShareWhatsApp = () => {
    const contactInfo = contact ? contact.name : 'Customer';
    const message = getWhatsAppMessage(
      transaction,
      contactInfo,
      activity ? `${activity.icon} ${activity.type}` : 'Other',
      state.userWhatsApp,
      lineItems,
      transaction.installmentPlan
        ? { current: transaction.installmentPlan.paidInstallments + 1, total: transaction.installmentPlan.totalInstallments }
        : undefined
    );

    if (contact?.phone) {
      openWhatsApp(contact.phone, message);
    } else {
      Alert.alert('No Number', 'This contact does not have a phone number.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={24} stroke={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Debt Details</Text>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.statusBanner, { backgroundColor: statusBg + '80', borderLeftColor: statusColor }]}>
          <View style={[styles.statusIconContainer, { backgroundColor: statusColor + '20' }]}>
            <StatusIcon size={24} stroke={statusColor} />
          </View>
          <View>
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
            <Text style={styles.statusSubtext}>
              {transaction.status === 'OVERDUE'
                ? 'This payment is past due'
                : transaction.status === 'GRACE'
                  ? 'Payment is expected soon'
                  : 'Fully settled'}
            </Text>
          </View>
        </View>

        <View style={[styles.summaryCard, Shadows.sm]}>
          <View style={styles.summaryRow}>
            <User size={16} stroke={Colors.textMuted} />
            <Text style={styles.summaryLabel}>Debtor</Text>
            <Text style={styles.summaryValue}>{contact?.name ?? 'Unknown'}</Text>
            {contact?.phone ? (
              <Text style={styles.summaryPhone}>{contact.phone}</Text>
            ) : null}
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <ActivityIcon size={16} stroke={Colors.textMuted} />
            <Text style={styles.summaryLabel}>Category</Text>
            <Text style={styles.summaryValue}>
              {activity?.icon ?? ''} {activity?.type ?? 'Other'}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Calendar size={16} stroke={Colors.textMuted} />
            <Text style={styles.summaryLabel}>Recorded</Text>
            <Text style={styles.summaryValue}>
              {formatDateDisplay(transaction.dateRecorded)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Calendar size={16} stroke={Colors.textMuted} />
            <Text style={styles.summaryLabel}>Due Date</Text>
            <Text style={styles.summaryValue}>
              {formatDateDisplay(transaction.dueDate)}
            </Text>
          </View>
        </View>

        <View style={[styles.amountCard, Shadows.sm]}>
          <View style={styles.amountRow}>
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>Total</Text>
              <Text style={styles.amountValue}>{formatCurrency(transaction.totalAmount)}</Text>
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountCol}>
              <Text style={styles.amountLabel}>Remaining</Text>
              <Text style={[styles.amountValue, { color: statusColor }]}>
                {formatCurrency(transaction.remainingBalance)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summarySection}>
          <Text style={styles.summaryTitle}>{transaction.summaryText}</Text>
        </View>

        {lineItems.length > 0 && (
          <View style={[styles.lineItemsSection, Shadows.sm]}>
            <Text style={styles.sectionTitle}>Line Items</Text>
            {lineItems.map((item) => (
              <View key={item.id} style={styles.lineItemRow}>
                <Circle size={8} stroke={Colors.accent} fill={Colors.accent} />
                <Text style={styles.lineItemDesc}>{item.itemDescription}</Text>
                {item.itemCost != null && (
                  <Text style={styles.lineItemCost}>{formatCurrency(item.itemCost)}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {transaction.status !== 'PAID' && (
          <View style={[styles.reminderCard, Shadows.sm]}>
            <Bell size={18} stroke={Colors.primaryLight} />
            <View style={styles.reminderInfo}>
              <Text style={styles.reminderTitle}>Auto Reminders</Text>
              <Text style={styles.reminderText}>
                Get notified 1 day before and after the due date
              </Text>
            </View>
            {remindersScheduled ? (
              <TouchableOpacity style={styles.reminderBtn} onPress={handleCancelReminders}>
                <BellOff size={16} stroke={Colors.red} />
                <Text style={[styles.reminderBtnText, { color: Colors.red }]}>Cancel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.reminderBtn, styles.reminderBtnActive]}
                onPress={handleScheduleReminders}
              >
                <Bell size={16} stroke={Colors.white} />
                <Text style={styles.reminderBtnText}>Enable</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {showPaymentInput && (
          <View style={[styles.paymentInputCard, Shadows.sm]}>
            <Text style={styles.paymentInputTitle}>Log Partial Payment</Text>
            <TextInput
              style={styles.paymentInput}
              placeholder="Enter amount"
              placeholderTextColor={Colors.textMuted}
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.paymentActions}>
              <TouchableOpacity
                style={styles.cancelPaymentBtn}
                onPress={() => {
                  setShowPaymentInput(false);
                  setPaymentAmount('');
                }}
              >
                <Text style={styles.cancelPaymentText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmPaymentBtn} onPress={handlePayment}>
                <Text style={styles.confirmPaymentText}>Confirm Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {transaction.installmentPlan && transaction.status !== 'PAID' && transaction.status !== 'BAD_DEBT' && (
          <View style={[styles.installmentCard, Shadows.sm]}>
            <Text style={styles.installmentTitle}>Installment Plan</Text>
            <Text style={styles.installmentInfo}>
              {transaction.installmentPlan.paidInstallments}/{transaction.installmentPlan.totalInstallments} paid — M {transaction.installmentPlan.installmentAmount.toLocaleString()} / installment ({transaction.installmentPlan.frequency})
            </Text>
            {transaction.installmentPlan.paidInstallments < transaction.installmentPlan.totalInstallments && (
              <TouchableOpacity
                style={styles.installmentPayBtn}
                onPress={() => {
                  Alert.alert(
                    'Pay Installment',
                    `Record payment of M ${transaction.installmentPlan!.installmentAmount.toLocaleString()} for this installment?`,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Pay', onPress: () => payInstallment(transaction.id),
                      },
                    ]
                  );
                }}
              >
                <Text style={styles.installmentPayText}>Pay Next Installment</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {transaction.status !== 'BAD_DEBT' && !transaction.archived && transaction.status !== 'PAID' && (
          <TouchableOpacity
            style={[styles.dangerBtn, { backgroundColor: Colors.textMuted }]}
            onPress={() => {
              Alert.alert('Write Off', 'Mark this debt as unrecoverable?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Write Off', style: 'destructive', onPress: () => {
                  if (Platform.OS === 'ios') {
                    Alert.prompt('Write Off Reason', 'Why is this debt unrecoverable?', (reason) => {
                      if (reason?.trim()) markBadDebt(transaction.id, reason.trim());
                    });
                  } else {
                    markBadDebt(transaction.id, 'Unrecoverable');
                  }
                }},
              ]);
            }}
          >
            <Ban size={18} stroke={Colors.white} />
            <Text style={styles.dangerBtnText}>Mark as Bad Debt</Text>
          </TouchableOpacity>
        )}

        {!transaction.archived && (
          <TouchableOpacity
            style={[styles.dangerBtn, { backgroundColor: Colors.primaryLight }]}
            onPress={() => {
              Alert.alert('Archive', 'Move this debt to archive?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Archive', onPress: () => {
                  archiveDebt(transaction.id);
                  Alert.alert('Archived', 'Debt moved to archive.');
                }},
              ]);
            }}
          >
            <Archive size={18} stroke={Colors.white} />
            <Text style={styles.dangerBtnText}>Archive Debt</Text>
          </TouchableOpacity>
        )}

        <View style={styles.actionsRow}>
          {transaction.remainingBalance > 0 && !showPaymentInput && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowPaymentInput(true)}
            >
              <DollarSign size={20} stroke={Colors.white} />
              <Text style={styles.actionBtnText}>Log Partial Payment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionBtn, styles.whatsappBtn]}
            onPress={handleShareWhatsApp}
          >
            <Share2 size={20} stroke={Colors.white} />
            <Text style={styles.actionBtnText}>Share WhatsApp Reminder</Text>
          </TouchableOpacity>
        </View>

        {!transaction.archived && (
          <TouchableOpacity
            style={[styles.dangerBtn, { backgroundColor: Colors.red }]}
            onPress={() => {
              Alert.alert('Delete Debt', 'Permanently delete this debt?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                  deleteTransaction(transaction.id);
                  router.back();
                }},
              ]);
            }}
          >
            <Trash2 size={18} stroke={Colors.white} />
            <Text style={styles.dangerBtnText}>Delete Debt</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxxl * 2,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderLeftWidth: 4,
  },
  statusIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  statusSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 28,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    width: 70,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  summaryPhone: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  amountCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  amountCol: {
    alignItems: 'center',
  },
  amountDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  amountLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 4,
  },
  summarySection: {
    marginBottom: Spacing.lg,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  lineItemsSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  lineItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border + '60',
  },
  lineItemDesc: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  lineItemCost: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  reminderInfo: {
    flex: 1,
  },
  reminderTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  reminderText: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  reminderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.inputBg,
  },
  reminderBtnActive: {
    backgroundColor: Colors.primaryLight,
  },
  reminderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  paymentInputCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  paymentInputTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: Spacing.md,
  },
  paymentInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlign: 'center',
  },
  paymentActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  cancelPaymentBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.border,
  },
  cancelPaymentText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  confirmPaymentBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  confirmPaymentText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  installmentCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: Colors.accent + '40',
  },
  installmentTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.accent,
    marginBottom: Spacing.xs,
  },
  installmentInfo: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  installmentPayBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  installmentPayText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  dangerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  actionsRow: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    ...Platform.select({
      ios: {
        shadowColor: '#25D366',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  actionBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.white,
  },
});
