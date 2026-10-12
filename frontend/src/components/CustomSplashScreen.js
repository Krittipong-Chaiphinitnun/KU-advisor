// CustomSplashScreen.js – animated splash screen for KU‑advisor
// --------------------------------------------------------------
// Shows the high‑resolution splash PNG on a dark emerald background
// and fades out after a short delay. It is displayed in the root
// layout before the Expo splash screen is hidden.
// --------------------------------------------------------------
import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

export default function CustomSplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Keep the splash visible for a short period, then fade out
    const timeout = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setVisible(false);
        if (onFinish) onFinish();
      });
    }, 1500); // 1.5 s display before fade
    return () => clearTimeout(timeout);
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Image
        source={require('../../assets/splash.png')}
        style={styles.image}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#004D25',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  image: {
    width: '70%',
    height: '70%',
  },
});
