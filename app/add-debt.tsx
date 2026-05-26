import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { Contact as ExpoContact, ContactField, ContactsSortOrder, requestPermissionsAsync } from 'expo-contacts';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  X, Plus, Trash2, User, ChevronDown, Search,
  LayoutGrid, Smartphone,
} from 'lucide-react-native';
import { useApp } from '../src/store';
import { generateId, CATEGORY_ICONS } from '../src/data';
import { Colors, Spacing, BorderRadius, Shadows } from '../src/theme';
import type { Contact as AppContact, Activity, InstallmentFrequency } from '../src/types';

interface BulletItem {
  key: string;
  description: string;
  cost: string;
}

let bulletKeyCounter = 0;
const newBulletKey = () => `bullet_${++bulletKeyCounter}_${Date.now()}`;

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AddDebt() {
  const router = useRouter();
  const { addTransaction, addActivity, addContact, updateContact, state } = useApp();

  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [summary, setSummary] = useState('');
  const [dueDate, setDueDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bullets, setBullets] = useState<BulletItem[]>([
    { key: newBulletKey(), description: '', cost: '' },
  ]);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [deviceContacts, setDeviceContacts] = useState<{ id: string; fullName: string | null; phones: { label?: string; number?: string }[]; emails: { label?: string; email?: string }[] }[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [useInstallment, setUseInstallment] = useState(false);
  const [installmentCount, setInstallmentCount] = useState(3);
  const [installmentFreq, setInstallmentFreq] = useState<InstallmentFrequency>('monthly');

  const dateRecorded = useMemo(() => formatDate(new Date()), []);

  const totalAmount = useMemo(() => {
    return bullets.reduce((sum, b) => {
      const cost = parseFloat(b.cost);
      return sum + (isNaN(cost) ? 0 : cost);
    }, 0);
  }, [bullets]);

  useEffect(() => {
    if (showContactPicker && deviceContacts.length === 0 && !loadingContacts) {
      loadDeviceContacts();
    }
  }, [showContactPicker]);

  const loadDeviceContacts = async () => {
    setLoadingContacts(true);
    try {
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        setLoadingContacts(false);
        return;
      }
      const details = await ExpoContact.getAllDetails(
        [ContactField.FULL_NAME, ContactField.PHONES, ContactField.EMAILS],
        { sortOrder: ContactsSortOrder.GivenName }
      );
      setDeviceContacts(details.filter((c) => c.fullName && ((c.phones && c.phones.length > 0) || (c.emails && c.emails.length > 0))));
    } catch {
      // silently fail
    }
    setLoadingContacts(false);
  };

  const addBullet = () => {
    setBullets((prev) => [...prev, { key: newBulletKey(), description: '', cost: '' }]);
  };

  const removeBullet = (key: string) => {
    if (bullets.length <= 1) return;
    setBullets((prev) => prev.filter((b) => b.key !== key));
  };

  const updateBullet = (key: string, field: 'description' | 'cost', value: string) => {
    setBullets((prev) =>
      prev.map((b) => (b.key === key ? { ...b, [field]: value } : b))
    );
  };

  const pickContact = (contact: AppContact) => {
    setContactName(contact.name);
    setContactPhone(contact.phone || '');
    setShowContactPicker(false);
  };

  const pickDeviceContact = (c: { id: string; fullName: string | null; phones: { label?: string; number?: string }[]; emails: { label?: string; email?: string }[] }) => {
    const phone = c.phones?.[0]?.number?.trim() || '';
    const email = c.emails?.[0]?.email?.trim() || '';
    const name = c.fullName || '';
    const existingContact = state.contacts.find(
      (sc) => sc.name.toLowerCase() === name.toLowerCase()
    );
    if (!existingContact) {
      addContact({ name, phone, email, whatsappLink: '' });
    } else {
      updateContact({ ...existingContact, phone: phone || existingContact.phone, email: email || existingContact.email, whatsappLink: existingContact.whatsappLink || '' });
    }
    setContactName(name);
    setContactPhone(phone || existingContact?.phone || '');
    setShowContactPicker(false);
    setContactSearch('');
  };

  const pickCategory = (activity: Activity) => {
    setSelectedActivity(activity);
    setShowCategoryPicker(false);
  };

  const handleSave = () => {
    if (!contactName.trim()) {
      Alert.alert('Required', 'Please enter the debtor name.');
      return;
    }
    if (!selectedActivity) {
      Alert.alert('Required', 'Please select a category.');
      return;
    }
    if (!summary.trim()) {
      Alert.alert('Required', 'Please enter a summary.');
      return;
    }
    if (totalAmount <= 0) {
      Alert.alert('Invalid', 'Please add at least one line item with a cost.');
      return;
    }

    let contact = state.contacts.find(
      (c) => c.name.toLowerCase() === contactName.trim().toLowerCase()
    );
    if (!contact) {
      const newContact = { name: contactName.trim(), phone: contactPhone.trim(), email: '', whatsappLink: '' };
      addContact(newContact);
      contact = { id: `c_${Date.now()}`, ...newContact };
    }

    const lineItems = bullets
      .filter((b) => b.description.trim().length > 0)
      .map((b) => ({
        itemDescription: b.description.trim(),
        itemCost: b.cost.trim() ? Number(b.cost.trim()) : undefined,
      }));

    const installmentPlan = useInstallment && totalAmount >= 500
      ? {
          totalInstallments: installmentCount,
          paidInstallments: 0,
          installmentAmount: Math.round(totalAmount / installmentCount),
          frequency: installmentFreq,
          startDate: formatDate(dueDate),
        }
      : undefined;

    addTransaction(
      {
        contactId: contact.id,
        activityId: selectedActivity.id,
        summaryText: summary.trim(),
        totalAmount,
        remainingBalance: totalAmount,
        dateRecorded,
        dueDate: formatDate(dueDate),
        status: 'GRACE',
        installmentPlan,
      },
      lineItems
    );

    router.back();
  };

  const isFormValid =
    contactName.trim().length > 0 &&
    selectedActivity !== null &&
    summary.trim().length > 0 &&
    totalAmount > 0;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={24} stroke={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Debt Entry</Text>
        <View style={styles.closeBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Debtor Name</Text>
            <View style={styles.contactRow}>
              <TextInput
                style={[styles.input, styles.contactInput]}
                placeholder="Name"
                placeholderTextColor={Colors.textMuted}
                value={contactName}
                onChangeText={setContactName}
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => setShowContactPicker(!showContactPicker)}
              >
                <User size={20} stroke={Colors.accent} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { marginTop: Spacing.sm }]}
              placeholder="Phone (optional)"
              placeholderTextColor={Colors.textMuted}
              value={contactPhone}
              onChangeText={setContactPhone}
              keyboardType="phone-pad"
            />
            {showContactPicker && (
              <Modal visible transparent animationType="slide">
                <SafeAreaView style={styles.contactModal}>
                  <View style={styles.contactModalHeader}>
                    <Text style={styles.contactModalTitle}>Select Contact</Text>
                    <TouchableOpacity onPress={() => { setShowContactPicker(false); setContactSearch(''); }}>
                      <X size={22} stroke={Colors.textPrimary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.contactSearchRow}>
                    <Search size={18} stroke={Colors.textMuted} />
                    <TextInput
                      style={styles.contactSearchInput}
                      placeholder="Search contacts..."
                      placeholderTextColor={Colors.textMuted}
                      value={contactSearch}
                      onChangeText={setContactSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    {contactSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setContactSearch('')}>
                        <X size={18} stroke={Colors.textMuted} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <FlatList
                    data={(() => {
                      const q = contactSearch.toLowerCase().trim();
                      const device = q
                        ? deviceContacts.filter((c) => c.fullName?.toLowerCase().includes(q))
                        : deviceContacts;
                      const saved = q
                        ? state.contacts.filter((c) => c.name.toLowerCase().includes(q))
                        : state.contacts;
                      return [
                        ...(loadingContacts ? [] : device.length > 0
                          ? [{ kind: 'header' as const, label: 'Device Contacts' }, ...device.slice(0, 50).map((c) => ({ kind: 'device' as const, c }))]
                          : [{ kind: 'empty' as const, label: 'No contacts found' }]),
                        ...(saved.length > 0
                          ? [{ kind: 'header' as const, label: 'Saved Debtors' }, ...saved.map((c) => ({ kind: 'saved' as const, c }))]
                          : []),
                      ];
                    })()}
                    keyExtractor={(item, i) => `${item.kind}-${i}`}
                    renderItem={({ item }) => {
                      if (item.kind === 'header') {
                        return (
                          <View style={styles.contactSectionHeader}>
                            <Smartphone size={14} stroke={Colors.textSecondary} />
                            <Text style={styles.contactSectionLabel}>{item.label}</Text>
                          </View>
                        );
                      }
                      if (item.kind === 'empty') {
                        return <Text style={styles.contactEmpty}>{item.label}</Text>;
                      }
                      if (item.kind === 'device') {
                        const displayPhone = item.c.phones?.[0]?.number || '';
                        const displayEmail = item.c.emails?.[0]?.email || '';
                        return (
                          <TouchableOpacity style={styles.contactItem} onPress={() => pickDeviceContact(item.c)}>
                            <User size={16} stroke={Colors.textSecondary} />
                            <View style={styles.contactItemInfo}>
                              <Text style={styles.contactItemName} numberOfLines={1}>{item.c.fullName}</Text>
                              {displayPhone ? <Text style={styles.contactItemSub} numberOfLines={1}>{displayPhone}</Text> : null}
                              {displayEmail ? <Text style={styles.contactItemSub} numberOfLines={1}>{displayEmail}</Text> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity style={styles.contactItem} onPress={() => pickContact(item.c)}>
                          <User size={16} stroke={Colors.textSecondary} />
                          <View style={styles.contactItemInfo}>
                            <Text style={styles.contactItemName} numberOfLines={1}>{item.c.name}</Text>
                            {item.c.phone ? <Text style={styles.contactItemSub} numberOfLines={1}>{item.c.phone}</Text> : null}
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                    style={styles.contactList}
                    keyboardShouldPersistTaps="handled"
                  />
                </SafeAreaView>
              </Modal>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Category</Text>
            <TouchableOpacity
              style={styles.selectBtn}
              onPress={() => setShowCategoryPicker(true)}
            >
              {selectedActivity ? (
                <View style={styles.selectDisplay}>
                  <Text style={styles.selectIcon}>{selectedActivity.icon}</Text>
                  <Text style={styles.selectText}>{selectedActivity.type}</Text>
                </View>
              ) : (
                <View style={styles.selectDisplay}>
                  <LayoutGrid size={18} stroke={Colors.textMuted} />
                  <Text style={styles.selectPlaceholder}>Select a category</Text>
                </View>
              )}
              <ChevronDown size={18} stroke={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Summary</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Planting Season Kickoff"
              placeholderTextColor={Colors.textMuted}
              value={summary}
              onChangeText={setSummary}
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.splitRow}>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionLabel}>Date Recorded</Text>
              <View style={[styles.input, styles.dateDisplay]}>
                <Text style={styles.dateText}>{dateRecorded}</Text>
              </View>
            </View>
            <View style={[styles.section, { flex: 1 }]}>
              <Text style={styles.sectionLabel}>Due Date</Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.dateText}>{formatDate(dueDate)}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={dueDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onValueChange={(event, date) => {
                    setShowDatePicker(Platform.OS === 'ios');
                    if (date) setDueDate(date);
                  }}
                />
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Line Items</Text>
              <TouchableOpacity style={styles.addBulletBtn} onPress={addBullet}>
                <Plus size={16} stroke={Colors.accent} />
                <Text style={styles.addBulletText}>Add</Text>
              </TouchableOpacity>
            </View>
            {bullets.map((bullet, index) => (
              <View key={bullet.key} style={styles.bulletRow}>
                <View style={styles.bulletIndex}>
                  <Text style={styles.bulletIndexText}>{index + 1}</Text>
                </View>
                <View style={styles.bulletInputs}>
                  <TextInput
                    style={[styles.input, styles.bulletDesc]}
                    placeholder="Item"
                    placeholderTextColor={Colors.textMuted}
                    value={bullet.description}
                    onChangeText={(v) => updateBullet(bullet.key, 'description', v)}
                    autoCapitalize="sentences"
                  />
                  <TextInput
                    style={[styles.input, styles.bulletCost]}
                    placeholder="M"
                    placeholderTextColor={Colors.textMuted}
                    value={bullet.cost}
                    onChangeText={(v) => updateBullet(bullet.key, 'cost', v)}
                    keyboardType="numeric"
                  />
                </View>
                {bullets.length > 1 && (
                  <TouchableOpacity
                    onPress={() => removeBullet(bullet.key)}
                    style={styles.deleteBullet}
                  >
                    <Trash2 size={16} stroke={Colors.red} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {totalAmount >= 500 && (
            <View style={styles.installmentSection}>
              <View style={styles.installmentToggle}>
                <Text style={styles.installmentLabel}>Installment Plan</Text>
                <TouchableOpacity
                  style={[styles.toggleSwitch, useInstallment && styles.toggleSwitchActive]}
                  onPress={() => setUseInstallment((v) => !v)}
                >
                  <View style={[styles.toggleThumb, useInstallment && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>
              {useInstallment && (
                <>
                  <Text style={styles.installmentSub}>Number of Installments</Text>
                  <View style={styles.installmentOptions}>
                    {[2, 3, 4, 6].map((n) => (
                      <TouchableOpacity
                        key={n}
                        style={[styles.installmentOption, installmentCount === n && styles.installmentOptionActive]}
                        onPress={() => setInstallmentCount(n)}
                      >
                        <Text style={[styles.installmentOptionText, installmentCount === n && { color: Colors.white }]}>
                          {n}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.installmentSub}>Frequency</Text>
                  <View style={styles.installmentOptions}>
                    {(['weekly', 'biweekly', 'monthly'] as InstallmentFrequency[]).map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.installmentOption, installmentFreq === f && styles.installmentOptionActive]}
                        onPress={() => setInstallmentFreq(f)}
                      >
                        <Text style={[styles.installmentOptionText, installmentFreq === f && { color: Colors.white }]}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.installmentSummary}>
                    M {Math.round(totalAmount / installmentCount).toLocaleString()} × {installmentCount} installments ({installmentFreq})
                  </Text>
                </>
              )}
            </View>
          )}

          <View style={[styles.totalCard, Shadows.md]}>
            <Text style={styles.totalLabel}>Total Amount</Text>
            <Text style={styles.totalValue}>M {totalAmount.toLocaleString()}</Text>
            {totalAmount > 0 && (
              <Text style={styles.totalSub}>
                from {bullets.filter(b => b.cost.trim()).length} item
                {bullets.filter(b => b.cost.trim()).length !== 1 ? 's' : ''}
              </Text>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.saveBtn, !isFormValid && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isFormValid}
          >
            <Text style={styles.saveBtnText}>Save Debt Entry</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showCategoryPicker} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryPicker(false)}
        >
          <View style={[styles.modalContent, Shadows.lg]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Category</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCategoryPicker(false);
                  router.push('/categories');
                }}
              >
                <Text style={styles.modalAction}>Manage</Text>
              </TouchableOpacity>
            </View>
            {state.activities.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={styles.modalEmptyText}>No categories yet</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowCategoryPicker(false);
                    router.push('/categories');
                  }}
                >
                  <Text style={styles.modalActionLink}>Create one</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <ScrollView style={styles.modalList}>
                {state.activities.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[
                      styles.modalItem,
                      selectedActivity?.id === a.id && styles.modalItemActive,
                    ]}
                    onPress={() => pickCategory(a)}
                  >
                    <Text style={styles.modalItemIcon}>{a.icon}</Text>
                    <Text style={styles.modalItemText}>{a.type}</Text>
                    {selectedActivity?.id === a.id && (
                      <View style={styles.modalCheck}>
                        <Text style={styles.modalCheckText}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
    paddingBottom: Spacing.xxxl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  contactInput: {
    flex: 1,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.accent,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dateDisplay: {
    justifyContent: 'center',
  },
  dateText: {
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  selectDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  selectIcon: {
    fontSize: 22,
  },
  selectText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: Colors.textMuted,
  },
  splitRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  bulletIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Platform.OS === 'ios' ? 12 : 8,
  },
  bulletIndexText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
  },
  bulletInputs: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bulletDesc: {
    flex: 2,
  },
  bulletCost: {
    flex: 1,
  },
  deleteBullet: {
    padding: Spacing.sm,
    marginTop: Platform.OS === 'ios' ? 8 : 4,
  },
  addBulletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBulletText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accent,
  },
  installmentSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1.5,
    borderColor: Colors.accent + '30',
  },
  installmentToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  installmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: Colors.green,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  installmentSub: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  installmentOptions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  installmentOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  installmentOptionActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  installmentOptionText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  installmentSummary: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  totalCard: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white + 'BB',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.white,
    marginTop: Spacing.xs,
    letterSpacing: -0.5,
  },
  totalSub: {
    fontSize: 13,
    color: Colors.white + '99',
    marginTop: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: Colors.accent,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
  contactModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contactModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  contactModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  contactSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  contactSearchInput: {
    flex: 1,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    fontSize: 16,
    color: Colors.textPrimary,
    marginLeft: Spacing.sm,
  },
  contactList: {
    flex: 1,
  },
  contactSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.inputBg,
  },
  contactSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  contactItemInfo: {
    flex: 1,
  },
  contactItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  contactItemSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 2,
  },
  contactEmpty: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xxl,
    maxHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  modalAction: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  modalEmptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  modalActionLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.accent,
  },
  modalList: {
    maxHeight: 300,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xs,
  },
  modalItemActive: {
    backgroundColor: Colors.primaryLight + '10',
  },
  modalItemIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  modalCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCheckText: {
    fontSize: 14,
    fontWeight: '800',
    color: Colors.white,
  },
});
