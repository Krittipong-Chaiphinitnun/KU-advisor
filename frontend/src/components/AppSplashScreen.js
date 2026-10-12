/**
 * AppSplashScreen.js
 * ------------------
 * A custom in-app animated splash / loading screen for KU-advisor.
 *
 * Shows the Kasetsart Emerald-Green (#004D25) background with a
 * gold (#D4AF37) graduation-cap SVG logo and "KU-advisor" wordmark.
 * The content fades + scales in, then fades out when `onFinish` fires.
 *
 * Usage
 * -----
 * ```jsx
 * import AppSplashScreen from '../components/AppSplashScreen';
 *
 * const [ready, setReady] = useState(false);
 *
 * if (!ready) return <AppSplashScreen onFinish={() => setReady(true)} />;
 * ```
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StatusBar,
} from 'react-native';

// ── Brand colours ────────────────────────────────────────────────────────────
const EMERALD = '#004D25';
const GOLD    = '#D4AF37';

// ── The component ────────────────────────────────────────────────────────────
export default function AppSplashScreen({ onFinish, displayDuration = 2200 }) {
  const fadeAnim  = useRef(new Animated.Value(0)).current;   // 0 → 1 → 0
  const scaleAnim = useRef(new Animated.Value(0.85)).current; // 0.85 → 1

  useEffect(() => {
    // Phase 1 — fade-in + scale-up
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.back(1.4)),
        useNativeDriver: true,
      }),
    ]).start();

    // Phase 2 — hold, then fade-out
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (onFinish) onFinish();
      });
    }, displayDuration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar backgroundColor={EMERALD} barStyle="light-content" />

      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        {/* ── Graduation-cap icon (pure RN shapes) ──────────────────────── */}
        <View style={styles.iconContainer}>
          {/* Cap diamond */}
          <View style={styles.capDiamond} />
          {/* Tassel line */}
          <View style={styles.tasselLine} />
          {/* Tassel ball */}
          <View style={styles.tasselBall} />
          {/* Sparkle dots */}
          <View style={[styles.sparkle, styles.sparkleTopRight]} />
          <View style={[styles.sparkleSm, styles.sparkleTopLeft]} />
        </View>

        {/* ── Book shape ────────────────────────────────────────────────── */}
        <View style={styles.bookRow}>
          <View style={styles.bookPage} />
          <View style={styles.bookSpine} />
          <View style={styles.bookPage} />
        </View>

        {/* ── Wordmark ──────────────────────────────────────────────────── */}
        <Text style={styles.title}>KU-advisor</Text>
        <Text style={styles.subtitle}>AI Academic Advising</Text>
      </Animated.View>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: EMERALD,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  content: {
    alignItems: 'center',
  },

  /* ── Icon container (graduation cap + tassel) ──────────────────────────── */
  iconContainer: {
    width: 160,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  capDiamond: {
    width: 120,
    height: 60,
    backgroundColor: GOLD,
    transform: [{ rotate: '45deg' }, { scaleX: 1.8 }, { scaleY: 0.8 }],
    borderRadius: 6,
  },
  tasselLine: {
    position: 'absolute',
    right: 22,
    top: 58,
    width: 2,
    height: 36,
    backgroundColor: GOLD,
  },
  tasselBall: {
    position: 'absolute',
    right: 16,
    top: 92,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: GOLD,
  },
  sparkle: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: GOLD,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },
  sparkleSm: {
    position: 'absolute',
    width: 8,
    height: 8,
    backgroundColor: GOLD,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  sparkleTopRight: {
    top: 6,
    right: 14,
  },
  sparkleTopLeft: {
    top: 22,
    left: 14,
  },

  /* ── Book ───────────────────────────────────────────────────────────────── */
  bookRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  bookPage: {
    width: 56,
    height: 22,
    backgroundColor: 'rgba(212,175,55,0.25)',
    borderWidth: 1.5,
    borderColor: GOLD,
    borderRadius: 3,
  },
  bookSpine: {
    width: 4,
    height: 28,
    backgroundColor: GOLD,
    borderRadius: 2,
    marginHorizontal: 2,
  },

  /* ── Text ───────────────────────────────────────────────────────────────── */
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(212,175,55,0.7)',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
