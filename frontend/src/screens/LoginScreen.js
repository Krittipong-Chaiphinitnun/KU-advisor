/**
 * src/screens/LoginScreen.js
 * --------------------------
 * Student login & registration screen.
 * KU Green theme: #004D25 with Gold (#D4AF37) accents.
 */

import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { loginUser, registerUser } from '../services/api';

const KU_GREEN      = '#004D25';
const KU_GREEN_LIGHT = '#006633';
const KU_GOLD       = '#D4AF37';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();

  const [mode, setMode]           = useState('login'); // 'login' | 'register'
  const [studentId, setStudentId] = useState('');
  const [password, setPassword]   = useState('');
  const [fullName, setFullName]   = useState('');
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async () => {
    if (!studentId.trim() || !password.trim()) {
      Alert.alert('กรุณากรอกข้อมูลให้ครบ', 'รหัสนิสิต และ รหัสผ่าน จำเป็นต้องกรอก');
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      Alert.alert('กรุณากรอกชื่อ-สกุล');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await loginUser({ student_id: studentId.trim(), password });
        signIn(res.data.user);
        router.replace('/(tabs)');
      } else {
        await registerUser({
          student_id: studentId.trim(),
          password,
          full_name: fullName.trim(),
        });
        Alert.alert('สมัครสมาชิกสำเร็จ! 🎉', 'คุณสามารถเข้าสู่ระบบได้แล้ว', [
          { text: 'เข้าสู่ระบบ', onPress: () => setMode('login') },
        ]);
      }
    } catch (err) {
      const detail = err.response?.data?.detail ?? err.message;
      Alert.alert(mode === 'login' ? 'เข้าสู่ระบบไม่สำเร็จ' : 'สมัครไม่สำเร็จ', detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Header & Branding ────────────────────────────────────────── */}
          <View style={styles.header}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>KU-advisor</Text>
            <Text style={styles.subtitle}>ที่ปรึกษาทางวิชาการอัจฉริยะ</Text>
            <View style={styles.badgeContainer}>
              <Text style={styles.badgeText}>KASETSART UNIVERSITY</Text>
            </View>
          </View>

          {/* ── Auth Card ────────────────────────────────────────────────── */}
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              {/* Tab Toggle */}
              <View style={styles.tabRow}>
                <TouchableOpacity
                  style={[styles.tab, mode === 'login' && styles.tabActive]}
                  onPress={() => setMode('login')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
                    เข้าสู่ระบบ
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tab, mode === 'register' && styles.tabActive]}
                  onPress={() => setMode('register')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
                    สมัครสมาชิก
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              {mode === 'register' && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>ชื่อ-นามสกุล</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="เช่น สมชาย ใจดี"
                    placeholderTextColor="#999"
                    value={fullName}
                    onChangeText={setFullName}
                    autoCapitalize="words"
                  />
                </View>
              )}

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>รหัสนิสิต</Text>
                <TextInput
                  style={styles.input}
                  placeholder="เช่น 6510405001"
                  placeholderTextColor="#999"
                  value={studentId}
                  onChangeText={setStudentId}
                  keyboardType="number-pad"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>รหัสผ่าน</Text>
                <TextInput
                  style={styles.input}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  placeholderTextColor="#999"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>
                    {mode === 'login' ? 'เข้าสู่ระบบ →' : 'สมัครสมาชิก →'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <Text style={styles.footer}>KU-advisor v2.0 · Powered by Gemini 3.6 Flash</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: KU_GREEN,
  },
  flex: {
    flex: 1,
    backgroundColor: KU_GREEN,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  // Header & Logo
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoWrapper: {
    width: 76,
    height: 76,
    borderRadius: 20,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  logoImage: {
    width: 52,
    height: 52,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  badgeContainer: {
    marginTop: 10,
    backgroundColor: KU_GOLD,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: KU_GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Card Container & Box
  cardContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#F0F4F0',
    borderRadius: 14,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: KU_GREEN,
    shadowColor: KU_GREEN,
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Fields
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#E2E8E2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 13 : 10,
    fontSize: 15,
    color: '#222222',
    backgroundColor: '#FAFAFA',
  },

  // Submit Button
  btn: {
    backgroundColor: KU_GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    shadowColor: KU_GREEN,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Footer
  footer: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 24,
  },
});
