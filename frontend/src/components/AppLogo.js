// AppLogo.js – reusable logo component for Expo/React Native
// ---------------------------------------------------------------
import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * AppLogo – a crisp, high‑quality vector/PNG logo component.
 *
 * @param {object} props
 * @param {number} [props.size=64]   – Desired width/height in dp.
 * @param {object} [props.style]      – Custom container or image style.
 */
export default function AppLogo({ size = 64, style }) {
  return (
    <View style={[{ width: size, height: size }, styles.container, style]}>
      <Image
        source={require('../../assets/icon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

