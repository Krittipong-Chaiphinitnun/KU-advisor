/**
 * src/screens/DashboardScreen.js
 * --------------------------------
 * Welcome dashboard with user stats, quick-action cards, and RAG status.
 */

import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchStatus } from '../services/api';
import { useAuth } from '../context/AuthContext';

const KU_GREEN      = '#006633';
const KU_GREEN_DARK = '#004d26';
const KU_GREEN_MID  = '#00803f';
const KU_GOLD       = '#C9A84C';

const ACTION_CARDS = [
  {
    id: 'chat',
    icon: '🤖',
    title: 'AI Chat Advisor',
    desc: 'ถามคำถามเกี่ยวกับหลักสูตร',
    tab: 'chat',
    color: '#006633',
  },
  {
    id: 'history',
    icon: '📋',
    title: 'ประวัติการปรึกษา',
    desc: 'ดูคำตอบที่ผ่านมาทั้งหมด',
    tab: 'history',
    color: '#005a2e',
  },
  {
    id: 'upload',
    icon: '📸',
    title: 'อัปโหลดทรานสคริปต์',
    desc: 'แนบรูปผลการเรียนเพื่อวิเคราะห์',
    tab: 'chat',
    color: '#004d26',
  },
];

export default function DashboardScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus()
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  const goToTab = (tab) => {
    // Map tab names to Expo Router paths within the (tabs) group
    router.navigate(`/(tabs)/${tab === 'index' ? '' : tab}`);
  };

  const handleSignOut = () => {
    signOut();
    router.replace('/login');
  };

  return (
    <ScrollView
      style={styles.bg}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero banner ──────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={styles.greeting}>สวัสดี 👋</Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.full_name ?? 'นิสิต KU'}
            </Text>
            <Text style={styles.userMeta}>
              รหัส: {user?.student_id ?? '-'} · {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'นิสิต'}
            </Text>
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>
              {(user?.full_name?.[0] ?? '?').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* RAG status pill */}
        {loading ? (
          <ActivityIndicator color={KU_GOLD} style={{ marginTop: 14 }} />
        ) : status ? (
          <View style={styles.pill}>
            <Text style={styles.pillDot}>●</Text>
            <Text style={styles.pillText}>
              โหลดหลักสูตรแล้ว {status.file_count} ไฟล์ · {status.context_chars.toLocaleString()} ตัวอักษร
            </Text>
          </View>
        ) : (
          <View style={[styles.pill, { backgroundColor: 'rgba(201,100,76,0.25)' }]}>
            <Text style={[styles.pillDot, { color: '#ff6b6b' }]}>●</Text>
            <Text style={styles.pillText}>ไม่สามารถเชื่อมต่อ API ได้</Text>
          </View>
        )}
      </View>

      {/* ── Section label ─────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>⚡ Quick Actions</Text>

      {/* ── Action cards ──────────────────────────────────────────────── */}
      {ACTION_CARDS.map((card) => (
        <TouchableOpacity
          key={card.id}
          style={[styles.card, { backgroundColor: card.color }]}
          activeOpacity={0.82}
          onPress={() => goToTab(card.tab)}
        >
          <Text style={styles.cardIcon}>{card.icon}</Text>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDesc}>{card.desc}</Text>
          </View>
          <Text style={styles.cardArrow}>›</Text>
        </TouchableOpacity>
      ))}

      {/* ── Info box ──────────────────────────────────────────────────── */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📚 วิทยาการและเทคโนโลยีดิจิทัล</Text>
        <Text style={styles.infoText}>
          KU-advisor ใช้เอกสารหลักสูตรจริงของมหาวิทยาลัย ผ่าน RAG Engine +
          Gemini 1.5 Flash เพื่อให้คำแนะนำที่แม่นยำและทันสมัย
        </Text>
      </View>

      {/* ── Sign out ──────────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <Text style={styles.signOutText}>ออกจากระบบ</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>KU-advisor v2.0 · Powered by Gemini 1.5 Flash</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#f3f7f3' },
  scroll: { paddingBottom: 48 },

  // Hero
  hero: {
    backgroundColor: KU_GREEN_DARK,
    paddingTop: 56,
    paddingBottom: 28,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroText: { flex: 1, paddingRight: 16 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  userName: { fontSize: 22, fontWeight: '800', color: '#fff' },
  userMeta: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: KU_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  pillDot:  { color: '#4ade80', fontSize: 10, marginRight: 6 },
  pillText: { color: '#fff', fontSize: 12, fontWeight: '500' },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    marginTop: 28,
    marginBottom: 12,
    marginHorizontal: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 18,
    padding: 18,
    shadowColor: '#006633',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  cardIcon:  { fontSize: 30, marginRight: 16 },
  cardBody:  { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardDesc:  { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 3 },
  cardArrow: { fontSize: 24, color: 'rgba(255,255,255,0.6)', fontWeight: '300' },

  // Info box
  infoBox: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginHorizontal: 20,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: KU_GREEN,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: KU_GREEN_DARK, marginBottom: 6 },
  infoText:  { fontSize: 13, color: '#555', lineHeight: 20 },

  // Sign out
  signOutBtn: {
    marginHorizontal: 20,
    marginTop: 28,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cc3333',
    alignItems: 'center',
  },
  signOutText: { color: '#cc3333', fontWeight: '700', fontSize: 14 },

  footer: {
    textAlign: 'center',
    color: '#aaa',
    fontSize: 11,
    marginTop: 24,
  },
});
