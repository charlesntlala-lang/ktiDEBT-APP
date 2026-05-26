import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { X, Fingerprint } from 'lucide-react-native';
import { useApp } from '../src/store';
import { Colors, Spacing, BorderRadius } from '../src/theme';
import { setSessionAuthenticated } from '../src/session';

export default function LockScreen() {
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const { state, setAuthPin } = useApp();

  const [pin, setPin] = useState('');
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(!state.authPin);
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const has = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (has && enrolled) {
        setBiometricAvailable(true);
        tryBiometric();
      } else {
        setShowPin(true);
      }
    } catch {
      setShowPin(true);
    }
  };

  const tryBiometric = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Add Debt',
        fallbackLabel: 'Use PIN',
      });
      if (result.success) {
        unlockSuccess();
      } else {
        setShowPin(true);
      }
    } catch {
      setShowPin(true);
    }
  };

  const unlockSuccess = () => {
    setSessionAuthenticated();
    const dest = returnTo || '/';
    setTimeout(() => router.replace(dest), 100);
  };

  const handlePinDigit = (digit: string) => {
    const newPin = pin + digit;
    if (newPin.length > 4) return;
    setPin(newPin);

    if (newPin.length === 4) {
      if (isFirstTime) {
        setAuthPin(newPin);
        unlockSuccess();
      } else {
        if (newPin === state.authPin) {
          unlockSuccess();
        } else {
          Alert.alert('Wrong PIN', 'Please try again');
          setPin('');
        }
      }
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.closeBtn}>
          <X size={24} stroke={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.title}>
          {isFirstTime ? 'Set Your PIN' : 'Enter PIN'}
        </Text>
        <Text style={styles.subtitle}>
          {isFirstTime
            ? 'Create a 4-digit PIN to secure debt entries'
            : 'Enter your 4-digit PIN to continue'}
        </Text>

        {showPin && (
          <View style={styles.dotsRow}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[styles.dot, pin.length > i && styles.dotFilled]}
              />
            ))}
          </View>
        )}

        {biometricAvailable && !showPin && (
          <TouchableOpacity style={styles.biometricBtn} onPress={tryBiometric}>
            <Fingerprint size={36} stroke={Colors.primaryLight} />
            <Text style={styles.biometricText}>Tap to Unlock</Text>
          </TouchableOpacity>
        )}
      </View>

      {showPin && (
        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0'].map(
            (digit, i) => {
              if (digit === '') {
                return <View key={i} style={styles.key} />;
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={styles.key}
                  onPress={() => handlePinDigit(digit)}
                  activeOpacity={0.6}
                >
                  <Text style={styles.keyText}>{digit}</Text>
                </TouchableOpacity>
              );
            }
          )}
          <TouchableOpacity style={styles.key} onPress={handleBackspace}>
            <Text style={styles.keyText}>⌫</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  lockIcon: {
    fontSize: 64,
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.border,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  biometricBtn: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xxl,
  },
  biometricText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primaryLight,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
