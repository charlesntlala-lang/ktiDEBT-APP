import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Check } from 'lucide-react-native';
import { useApp } from '../src/store';
import { Colors, Spacing, BorderRadius } from '../src/theme';

const { width } = Dimensions.get('window');

const slides = [
  {
    icon: '📋',
    title: 'Track Your Debts',
    description:
      'Keep a detailed record of everyone who owes you money. Never forget a debt again.',
  },
  {
    icon: '🏷️',
    title: 'Categorize & Organize',
    description:
      'Group your debts by categories like Shop, Agric, or Freelance. Find everything in seconds.',
  },
  {
    icon: '🔔',
    title: 'Get Reminders',
    description:
      'Auto-reminders before and after due dates. Share payment requests directly via WhatsApp.',
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { setOnboardingComplete } = useApp();
  const scrollRef = useRef<ScrollView>(null);
  const [slide, setSlide] = useState(0);
  const isLast = slide === slides.length - 1;

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setSlide(index);
  };

  const goNext = () => {
    if (isLast) {
      finish();
    } else {
      const next = slide + 1;
      scrollRef.current?.scrollTo({ x: next * width, animated: true });
      setSlide(next);
    }
  };

  const finish = () => {
    setOnboardingComplete(true);
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        {!isLast && (
          <TouchableOpacity onPress={finish} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {slides.map((s, i) => (
          <View key={i} style={styles.slide}>
            <Text style={styles.icon}>{s.icon}</Text>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.description}>{s.description}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === slide && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
          <Text style={styles.nextBtnText}>{isLast ? 'Get Started' : 'Next'}</Text>
          {isLast ? <Check size={20} stroke={Colors.white} /> : <ArrowRight size={20} stroke={Colors.white} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  top: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.xl,
  },
  skipBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  slide: {
    width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  icon: {
    fontSize: 80,
    marginBottom: Spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    letterSpacing: -0.5,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  },
  bottom: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
    alignItems: 'center',
    gap: Spacing.xxl,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.border,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 28,
    borderRadius: 5,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.xxxl,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  nextBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.white,
  },
});
