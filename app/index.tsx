import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import {
  Plus, TrendingUp, Clock, CheckCircle2,
  LayoutGrid, AlertTriangle, ArrowUpDown,
  ChevronDown, Search, X, DollarSign,
  Share2, Archive, Trash2, Ban,
} from 'lucide-react-native';
import { useApp } from '../src/store';
import { Colors, Spacing, BorderRadius, Shadows } from '../src/theme';
import { isSessionAuthenticated } from '../src/session';
import { DebtStatus, DebtTransaction } from '../src/types';
import { getReminderMessage, getWhatsAppMessage } from '../src/reminders';
import { openWhatsApp } from '../src/whatsapp';

function formatCurrency(amount: number): string {
  return `M ${amount.toLocaleString()}`;
}

function getStatusColor(status: DebtStatus): string {
  switch (status) {
    case 'OVERDUE': return Colors.red;
    case 'GRACE': return Colors.orange;
    case 'PAID': return Colors.green;
    case 'BAD_DEBT': return Colors.textMuted;
  }
}

function getStatusBg(status: DebtStatus): string {
  switch (status) {
    case 'OVERDUE': return Colors.redLight;
    case 'GRACE': return Colors.orangeLight;
    case 'PAID': return Colors.greenLight;
    case 'BAD_DEBT': return Colors.border;
  }
}

function getStatusLabel(status: DebtStatus): string {
  switch (status) {
    case 'OVERDUE': return 'Overdue';
    case 'GRACE': return 'Grace';
    case 'PAID': return 'Paid';
    case 'BAD_DEBT': return 'Bad Debt';
  }
}

const DebtCard = React.memo(function DebtCard({
  transaction,
  contactName,
  activityIcon,
  onPress,
  onMarkPaid,
  onSendReminder,
  onLongPress,
}: {
  transaction: DebtTransaction;
  contactName: string;
  activityIcon: string;
  onPress: () => void;
  onMarkPaid: () => void;
  onSendReminder: () => void;
  onLongPress: () => void;
}) {
  const statusColor = getStatusColor(transaction.status);
  const today = new Date();
  const due = new Date(transaction.dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isUrgent = transaction.status !== 'PAID' && transaction.status !== 'BAD_DEBT' && diffDays <= 2;

  const renderRightActions = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipePaid]}
      onPress={onMarkPaid}
      activeOpacity={0.8}
    >
      <DollarSign size={22} stroke={Colors.white} />
      <Text style={styles.swipeActionText}>Paid</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = () => (
    <TouchableOpacity
      style={[styles.swipeAction, styles.swipeRemind]}
      onPress={onSendReminder}
      activeOpacity={0.8}
    >
      <Share2 size={22} stroke={Colors.white} />
      <Text style={styles.swipeActionText}>Remind</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      renderLeftActions={renderLeftActions}
      overshootRight={false}
      overshootLeft={false}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={600}
        style={[styles.debtCard, Shadows.md]}
      >
        <View style={styles.debtCardTop}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <View style={styles.debtCardHeader}>
            <Text style={styles.debtorName} numberOfLines={1}>{contactName}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusBg(transaction.status) }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getStatusLabel(transaction.status)}
              </Text>
            </View>
          </View>
          <View style={styles.activityRow}>
            <Text style={styles.activityEmoji}>{activityIcon}</Text>
            <Text style={styles.summaryText} numberOfLines={1}>
              {transaction.summaryText}
            </Text>
          </View>
          {transaction.installmentPlan && (
            <View style={styles.installmentBadge}>
              <Text style={styles.installmentText}>
                Installment {transaction.installmentPlan.paidInstallments}/{transaction.installmentPlan.totalInstallments}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.debtCardDivider} />

        <View style={styles.debtCardFooter}>
          <View>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={[styles.balanceAmount, { color: statusColor }]}>
              {formatCurrency(transaction.remainingBalance)}
            </Text>
          </View>
          <View style={styles.dueSection}>
            {isUrgent && (
              <AlertTriangle size={14} stroke={Colors.red} />
            )}
            <Clock size={14} stroke={Colors.textMuted} />
            <Text style={[styles.dueDateText, isUrgent && { color: Colors.red }]}>
              {diffDays > 0
                ? `${diffDays}d left`
                : diffDays === 0
                  ? 'Due today'
                  : `${Math.abs(diffDays)}d overdue`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

type SortMode = 'newest' | 'oldest' | 'dueSoon' | 'dueLater';

const SORT_LABELS: Record<SortMode, string> = {
  newest: 'Newest First',
  oldest: 'Oldest First',
  dueSoon: 'Due Soon',
  dueLater: 'Due Later',
};

export default function Dashboard() {
  const router = useRouter();
  const {
    state, restored, addTransaction, getContact, getActivity, getLineItems,
    makePayment, markBadDebt, archiveDebt, deleteTransaction,
  } = useApp();
  const [activeFilter, setActiveFilter] = useState<string>('All');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [showSortModal, setShowSortModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!restored) return;
    if (!state.onboardingComplete) {
      router.replace('/onboarding');
    } else if (state.authEnabled && !isSessionAuthenticated()) {
      router.replace('/lock?returnTo=/');
    }
  }, [restored, state.onboardingComplete, state.authEnabled]);

  const activeTransactions = useMemo(
    () => state.transactions.filter((t) => showArchived ? t.archived : !t.archived),
    [state.transactions, showArchived]
  );

  const totalPendingBalance = useMemo(
    () => activeTransactions.reduce((sum, t) => sum + t.remainingBalance, 0),
    [activeTransactions]
  );

  const filters = useMemo(() => {
    const types = state.activities.map((a) => a.type);
    return ['All', ...types];
  }, [state.activities]);

  const filteredTransactions = useMemo(() => {
    let result = activeTransactions;

    if (activeFilter !== 'All') {
      const activityIds = state.activities
        .filter((a) => a.type === activeFilter)
        .map((a) => a.id);
      result = result.filter((t) => activityIds.includes(t.activityId));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((t) => {
        const contact = state.contacts.find((c) => c.id === t.contactId);
        if (!contact) return false;
        return (
          contact.name.toLowerCase().includes(q) ||
          contact.phone.toLowerCase().includes(q)
        );
      });
    }

    return result;
  }, [activeFilter, searchQuery, activeTransactions, state.activities, state.contacts]);

  const sortedTransactions = useMemo(() => {
    const list = [...filteredTransactions];
    switch (sortMode) {
      case 'newest': return list.sort((a, b) => b.dateRecorded.localeCompare(a.dateRecorded));
      case 'oldest': return list.sort((a, b) => a.dateRecorded.localeCompare(b.dateRecorded));
      case 'dueSoon': return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      case 'dueLater': return list.sort((a, b) => b.dueDate.localeCompare(a.dueDate));
      default: return list;
    }
  }, [filteredTransactions, sortMode]);

  const displayedTransactions = useMemo(() => {
    if (showAll) return sortedTransactions;
    return sortedTransactions.slice(0, 3);
  }, [sortedTransactions, showAll]);

  const hasMore = sortedTransactions.length > 3;

  const counts = useMemo(() => {
    let overdue = 0, grace = 0, paid = 0, bad = 0;
    state.transactions.forEach((t) => {
      if (t.status === 'OVERDUE') overdue++;
      else if (t.status === 'GRACE') grace++;
      else if (t.status === 'PAID') paid++;
      else if (t.status === 'BAD_DEBT') bad++;
    });
    return { overdue, grace, paid, bad };
  }, [state.transactions]);

  const urgentCount = useMemo(
    () => state.transactions.filter((t) => {
      if (t.status === 'PAID' || t.status === 'BAD_DEBT') return false;
      const due = new Date(t.dueDate);
      const diff = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff <= 2;
    }).length,
    [state.transactions]
  );

  const handleLoadMore = useCallback(() => setShowAll(true), []);
  const handleSortChange = useCallback((mode: SortMode) => {
    setSortMode(mode);
    setShowSortModal(false);
  }, []);

  const handleMarkPaid = useCallback((transaction: DebtTransaction) => {
    Alert.alert(
      'Mark as Paid',
      `Mark "${getContact(transaction.contactId)?.name || 'Unknown'}" debt as fully paid?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid', style: 'default',
          onPress: () => makePayment(transaction.id, transaction.remainingBalance),
        },
      ]
    );
  }, [getContact, makePayment]);

  const handleSendReminder = useCallback((transaction: DebtTransaction) => {
    const contact = getContact(transaction.contactId);
    const activity = getActivity(transaction.activityId);
    const name = contact?.name || 'Customer';
    const lines = getLineItems(transaction.id);
    const message = getWhatsAppMessage(
      transaction, name,
      activity ? `${activity.icon} ${activity.type}` : 'Other',
      state.userWhatsApp, lines,
      transaction.installmentPlan
        ? { current: transaction.installmentPlan.paidInstallments + 1, total: transaction.installmentPlan.totalInstallments }
        : undefined
    );
    if (contact?.phone) {
      openWhatsApp(contact.phone, message);
    }
  }, [getContact, getActivity, getLineItems, state.userWhatsApp]);

  const handleLongPress = useCallback((transaction: DebtTransaction) => {
    const isBad = transaction.status === 'BAD_DEBT';
    const isArchived = transaction.archived;
    Alert.alert(
      getContact(transaction.contactId)?.name || 'Debt',
      'Choose an action:',
      [
        ...(!isArchived ? [{
          text: 'Archive', style: 'default' as const,
          onPress: () => {
            Alert.alert('Archive', 'Move this debt to archive?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Archive', onPress: () => archiveDebt(transaction.id) },
            ]);
          },
        }] : []),
        ...(!isBad && !isArchived ? [{
          text: 'Write Off', style: 'destructive' as const,
          onPress: () => {
            Alert.prompt
              ? Alert.prompt('Write Off', 'Enter reason:', (reason) => {
                  if (reason?.trim()) markBadDebt(transaction.id, reason.trim());
                })
              : writeOffFallback(transaction.id);
          },
        }] : []),
        {
          text: 'Delete', style: 'destructive' as const,
          onPress: () => {
            Alert.alert('Delete', 'Permanently delete this debt?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: () => deleteTransaction(transaction.id) },
            ]);
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  }, [getContact, archiveDebt, markBadDebt, deleteTransaction]);

  const writeOffFallback = useCallback((id: string) => {
    Alert.alert('Write Off', 'Enter reason for writing off this debt:', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Write Off', onPress: () => {
        // Simple fallback — use a default reason
        markBadDebt(id, 'Unrecoverable');
      }},
    ]);
  }, [markBadDebt]);

  const renderItem = useCallback(({ item }: { item: DebtTransaction }) => {
    const contact = getContact(item.contactId);
    const activity = getActivity(item.activityId);
    return (
      <DebtCard
        transaction={item}
        contactName={contact?.name ?? 'Unknown'}
        activityIcon={activity?.icon ?? '📋'}
        onPress={() => router.push(`/debt/${item.id}`)}
        onMarkPaid={() => handleMarkPaid(item)}
        onSendReminder={() => handleSendReminder(item)}
        onLongPress={() => handleLongPress(item)}
      />
    );
  }, [getContact, getActivity, handleMarkPaid, handleSendReminder, handleLongPress]);

  const listHeader = useMemo(() => (
    <View>
      <View style={[styles.balanceCard, Shadows.lg]}>
        <View style={styles.balanceTop}>
          <View>
            <Text style={styles.balanceCardTitle}>
              {showArchived ? 'Archived Total' : 'Total Pending'}
            </Text>
            <Text style={styles.balanceCardAmount}>
              {formatCurrency(totalPendingBalance)}
            </Text>
          </View>
          {state.transactions.some((t) => t.archived) && (
            <TouchableOpacity
              style={[styles.archiveToggle, showArchived && styles.archiveToggleActive]}
              onPress={() => {
                setShowAll(true);
                setShowArchived((v) => !v);
              }}
            >
              <Archive size={16} stroke={showArchived ? Colors.white : Colors.primaryLight} />
              <Text style={[styles.archiveToggleText, showArchived && { color: Colors.white }]}>
                {showArchived ? 'Active' : 'Archived'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <TrendingUp size={14} stroke={Colors.red} />
            <Text style={[styles.statLabel, { color: Colors.red }]}>{counts.overdue}</Text>
            <Text style={[styles.statUnit, { color: Colors.red }]}>overdue</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Clock size={14} stroke={Colors.orange} />
            <Text style={[styles.statLabel, { color: Colors.orange }]}>{counts.grace}</Text>
            <Text style={[styles.statUnit, { color: Colors.orange }]}>grace</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <CheckCircle2 size={14} stroke={Colors.green} />
            <Text style={[styles.statLabel, { color: Colors.green }]}>{counts.paid}</Text>
            <Text style={[styles.statUnit, { color: Colors.green }]}>paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Ban size={14} stroke={Colors.textMuted} />
            <Text style={[styles.statLabel, { color: Colors.textMuted }]}>{counts.bad}</Text>
            <Text style={[styles.statUnit, { color: Colors.textMuted }]}>bad</Text>
          </View>
        </View>
      </View>

      {urgentCount > 0 && !showArchived && (
        <TouchableOpacity style={styles.alertBanner} activeOpacity={0.8}>
          <AlertTriangle size={16} stroke={Colors.white} />
          <Text style={styles.alertBannerText}>
            {urgentCount} debt{urgentCount !== 1 ? 's' : ''} due within 2 days
          </Text>
        </TouchableOpacity>
      )}

      {state.activities.length === 0 && state.transactions.length === 0 && (
        <View style={styles.onboardCard}>
          <Text style={styles.onboardIcon}>👋</Text>
          <Text style={styles.onboardTitle}>Welcome to KTIDEBT</Text>
          <Text style={styles.onboardText}>
            Start by creating categories to organize your debts, then add your first debt entry.
          </Text>
          <TouchableOpacity style={styles.onboardBtn} onPress={() => router.push('/categories')}>
            <LayoutGrid size={18} stroke={Colors.white} />
            <Text style={styles.onboardBtnText}>Create Categories</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.filterRow}>
        {filters.length > 1 && (
          <View style={styles.filterScroll}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={filters}
              keyExtractor={(f) => f}
              contentContainerStyle={styles.filterContent}
              renderItem={({ item: filter }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                  onPress={() => setActiveFilter(filter)}
                >
                  <Text style={[styles.filterChipText, activeFilter === filter && styles.filterChipTextActive]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
        <TouchableOpacity style={styles.sortBtn} onPress={() => setShowSortModal(true)}>
          <ArrowUpDown size={16} stroke={Colors.textSecondary} />
          <Text style={styles.sortBtnText}>{SORT_LABELS[sortMode].split(' ')[0]}</Text>
          <ChevronDown size={14} stroke={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {displayedTransactions.length === 0 && state.transactions.length > 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {showArchived ? 'No archived debts' : 'No debts match this filter'}
          </Text>
        </View>
      )}
    </View>
  ), [
    totalPendingBalance, showArchived, counts, urgentCount,
    state.transactions, state.activities, state.contacts,
    filters, activeFilter, sortMode, displayedTransactions,
  ]);

  const listFooter = useMemo(() => (
    <View>
      {hasMore && !showAll && (
        <TouchableOpacity style={styles.loadMoreBtn} activeOpacity={0.7} onPress={handleLoadMore}>
          <Text style={styles.loadMoreText}>
            Load More ({sortedTransactions.length - 3} remaining)
          </Text>
          <ChevronDown size={18} stroke={Colors.primaryLight} />
        </TouchableOpacity>
      )}
      {state.transactions.length > 0 && <View style={styles.bottomPadding} />}
    </View>
  ), [hasMore, showAll, sortedTransactions.length, handleLoadMore, state.transactions.length]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.appName}>KTIDEBT</Text>
          <Text style={styles.tagline}>Track. Remind. Recover.</Text>
        </View>
        <View style={styles.headerRight}>
          {urgentCount > 0 && !showArchived && (
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{urgentCount}</Text>
            </View>
          )}
          <TouchableOpacity style={styles.categoriesBtn} onPress={() => router.push('/categories')}>
            <LayoutGrid size={22} stroke={Colors.primaryLight} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} stroke={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={displayedTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={7}
      />

      <Modal visible={showSortModal} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowSortModal(false)}>
          <View style={[styles.sortModalContent, Shadows.lg]}>
            <Text style={styles.sortModalTitle}>Sort By</Text>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[styles.sortOption, sortMode === mode && styles.sortOptionActive]}
                onPress={() => handleSortChange(mode)}
              >
                <Text style={[styles.sortOptionText, sortMode === mode && styles.sortOptionTextActive]}>
                  {SORT_LABELS[mode]}
                </Text>
                {sortMode === mode && (
                  <View style={styles.sortCheck}>
                    <Text style={styles.sortCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.fab}
        onPress={() => router.push('/add-debt')}
      >
        <Plus size={26} stroke={Colors.white} />
      </TouchableOpacity>
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
  },
  appName: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
    fontWeight: '500',
  },
  categoriesBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 15,
    color: Colors.textPrimary,
  },
  searchClear: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    marginBottom: Spacing.md,
  },
  balanceTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  balanceCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceCardAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: Colors.primary,
    marginTop: Spacing.sm,
    letterSpacing: -1,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primaryLight,
  },
  archiveToggleActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primaryLight,
  },
  archiveToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    fontSize: 18,
    fontWeight: '800',
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.red,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  alertBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
    flex: 1,
  },
  onboardCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxxl,
    marginBottom: Spacing.xl,
  },
  onboardIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  onboardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  onboardText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  onboardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  onboardBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  filterScroll: {
    flex: 1,
    marginHorizontal: -Spacing.xl,
  },
  filterContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginLeft: Spacing.sm,
  },
  sortBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  debtCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  debtCardTop: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  debtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  debtorName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  activityEmoji: {
    fontSize: 14,
  },
  summaryText: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  installmentBadge: {
    alignSelf: 'flex-start',
    marginTop: Spacing.sm,
    marginLeft: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight + '15',
  },
  installmentText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  debtCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.lg,
  },
  debtCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    paddingTop: Spacing.md,
  },
  balanceLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  balanceAmount: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  dueSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueDateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  swipePaid: {
    backgroundColor: Colors.green,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  swipeRemind: {
    backgroundColor: '#25D366',
    borderTopRightRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
  },
  swipeActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    marginTop: 4,
  },
  emptyState: {
    paddingVertical: Spacing.xxxl * 2,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  sortModalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
  },
  sortModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  sortOptionActive: {
    backgroundColor: Colors.primaryLight + '10',
  },
  sortOptionText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  sortOptionTextActive: {
    color: Colors.primaryLight,
    fontWeight: '700',
  },
  sortCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortCheckText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
});
