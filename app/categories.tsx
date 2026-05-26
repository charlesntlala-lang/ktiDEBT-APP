import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { X, Plus, Pencil, Trash2, Save, XCircle } from 'lucide-react-native';
import { useApp } from '../src/store';
import { CATEGORY_ICONS } from '../src/data';
import { Colors, Spacing, BorderRadius } from '../src/theme';

export default function Categories() {
  const router = useRouter();
  const { state, addActivity, updateActivity, deleteActivity } = useApp();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(CATEGORY_ICONS[0]);

  const resetForm = () => {
    setName('');
    setSelectedIcon(CATEGORY_ICONS[0]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (id: string) => {
    const activity = state.activities.find((a) => a.id === id);
    if (!activity) return;
    setName(activity.type);
    setSelectedIcon(activity.icon || CATEGORY_ICONS[0]);
    setEditingId(id);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a category name.');
      return;
    }
    if (editingId) {
      updateActivity({ id: editingId, type: name.trim(), icon: selectedIcon });
    } else {
      addActivity({ id: '', type: name.trim(), icon: selectedIcon });
    }
    resetForm();
  };

  const handleDelete = (id: string, type: string) => {
    const inUse = state.transactions.some((t) => t.activityId === id);
    Alert.alert(
      'Delete Category',
      inUse
        ? `"${type}" is used by existing debts. Deleting it may affect those records. Proceed?`
        : `Delete "${type}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteActivity(id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <X size={24} stroke={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Categories</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          <Plus size={22} stroke={Colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {state.activities.length === 0 && !showForm && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyText}>No categories yet</Text>
            <Text style={styles.emptySubtext}>
              Create categories to organize your debts
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Plus size={18} stroke={Colors.white} />
              <Text style={styles.emptyBtnText}>Add Category</Text>
            </TouchableOpacity>
          </View>
        )}

        {showForm && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>
                {editingId ? 'Edit Category' : 'New Category'}
              </Text>
              <TouchableOpacity onPress={resetForm}>
                <XCircle size={20} stroke={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Shop, Agric, Freelance"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
              autoFocus
            />

            <Text style={styles.fieldLabel}>Icon</Text>
            <View style={styles.iconGrid}>
              {CATEGORY_ICONS.map((icon) => (
                <TouchableOpacity
                  key={icon}
                  style={[
                    styles.iconOption,
                    selectedIcon === icon && styles.iconOptionActive,
                  ]}
                  onPress={() => setSelectedIcon(icon)}
                >
                  <Text style={styles.iconEmoji}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Save size={18} stroke={Colors.white} />
              <Text style={styles.saveBtnText}>
                {editingId ? 'Update' : 'Save Category'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.list}>
          {state.activities.map((activity) => (
            <View key={activity.id} style={styles.itemCard}>
              <Text style={styles.itemIcon}>{activity.icon || '📁'}</Text>
              <Text style={styles.itemName} numberOfLines={1}>{activity.type}</Text>
              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.itemActionBtn}
                  onPress={() => handleEdit(activity.id)}
                >
                  <Pencil size={16} stroke={Colors.primaryLight} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.itemActionBtn, styles.deleteBtn]}
                  onPress={() => handleDelete(activity.id, activity.type)}
                >
                  <Trash2 size={16} stroke={Colors.red} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
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
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
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
    paddingBottom: Spacing.huge,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.huge * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
    textAlign: 'center',
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  formCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.accent + '40',
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: Colors.textPrimary,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  iconOption: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  iconOptionActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight + '40',
  },
  iconEmoji: {
    fontSize: 22,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xl,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
  list: {
    gap: Spacing.sm,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  itemIcon: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  itemActionBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: Colors.redLight + '60',
  },
});
