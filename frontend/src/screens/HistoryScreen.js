/**
 * src/screens/HistoryScreen.js
 * ----------------------------
 * Displays all past advising sessions fetched from the backend.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchHistory } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from 'expo-router';

const KU_GREEN      = '#006633';
const KU_GREEN_DARK = '#004d26';
const KU_GOLD       = '#C9A84C';

// ── Single message row inside an expanded session ────────────────────────────
function MessageRow({ msg }) {
  const isUser = msg.sender === 'user';
  return (
    <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
      <Text style={styles.msgSenderTag}>{isUser ? '👤 คุณ' : '🎓 KU-advisor'}</Text>
      <Text style={styles.msgContent}>{msg.content}</Text>
      <Text style={styles.msgTime}>
        {new Date(msg.created_at).toLocaleString('th-TH', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </Text>
    </View>
  );
}

// ── Collapsible session card ──────────────────────────────────────────────────
function SessionCard({ session, index }) {
  const [expanded, setExpanded] = useState(index === 0);

  const firstUserMsg = session.messages.find((m) => m.sender === 'user');
  const firstAiMsg   = session.messages.find((m) => m.sender === 'ai');
  const dateStr = new Date(session.created_at).toLocaleString('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <View style={styles.sessionCard}>
      <TouchableOpacity
        style={styles.sessionHeader}
        onPress={() => setExpanded((p) => !p)}
        activeOpacity={0.8}
      >
        <View style={styles.sessionIndexBadge}>
          <Text style={styles.sessionIndexText}>{index + 1}</Text>
        </View>
        <View style={styles.sessionHeaderText}>
          <Text style={styles.sessionDate}>{dateStr}</Text>
          <Text style={styles.sessionPreview} numberOfLines={1}>
            {firstUserMsg?.content ?? '(ไม่มีข้อความ)'}
          </Text>
        </View>
        <Text style={styles.sessionChevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.sessionBody}>
          {session.messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} />
          ))}
        </View>
      )}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>ยังไม่มีประวัติการปรึกษา</Text>
      <Text style={styles.emptyDesc}>
        เริ่มต้นถามคำถามใน AI Chat เพื่อบันทึกประวัติการปรึกษาครับ
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState(null);

  const loadHistory = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      try {
        const res = await fetchHistory(user.id);
        setSessions(res.data.sessions ?? []);
      } catch (err) {
        setError(err.response?.data?.detail ?? err.message);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id]
  );

  // Auto-reload when screen comes into focus (e.g. after a chat)
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.noUserText}>กรุณาเข้าสู่ระบบก่อนดูประวัติครับ</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📋 ประวัติการปรึกษา</Text>
        <Text style={styles.headerSub}>{user.full_name} · {user.student_id}</Text>
      </View>

      {/* ── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={KU_GREEN} />
          <Text style={styles.loadingText}>กำลังโหลดประวัติ...</Text>
        </View>
      ) : error ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />
          }
        >
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadHistory()}>
            <Text style={styles.retryText}>ลองใหม่</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : sessions.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />
          }
        >
          <EmptyState />
        </ScrollView>
      ) : (
        <FlatList
          data={sessions}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item, index }) => <SessionCard session={item} index={index} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHistory(true)}
              tintColor={KU_GREEN}
            />
          }
          ListHeaderComponent={
            <Text style={styles.sessionCount}>
              {sessions.length} การสนทนาทั้งหมด — ดึงลงเพื่อรีเฟรช
            </Text>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex:  { flex: 1, backgroundColor: '#f3f7f3' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },

  // Header
  header: {
    backgroundColor: KU_GREEN_DARK,
    paddingTop: 54,
    paddingBottom: 18,
    paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 3 },

  // List
  listContent:  { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  sessionCount: { fontSize: 12, color: '#888', marginBottom: 12, textAlign: 'center' },

  // Session card
  sessionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    gap: 12,
  },
  sessionIndexBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: KU_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionIndexText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  sessionHeaderText: { flex: 1 },
  sessionDate:    { fontSize: 11, color: '#888', marginBottom: 3 },
  sessionPreview: { fontSize: 13, fontWeight: '600', color: '#333' },
  sessionChevron: { fontSize: 12, color: '#aaa' },

  sessionBody: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },

  // Message rows
  msgRow: {
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
  },
  msgRowUser: { backgroundColor: '#e8f4ee' },
  msgRowAI:   { backgroundColor: '#f5f5f5' },
  msgSenderTag: {
    fontSize: 11,
    fontWeight: '700',
    color: KU_GREEN_DARK,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  msgContent: { fontSize: 13, color: '#333', lineHeight: 20 },
  msgTime:    { fontSize: 10, color: '#bbb', marginTop: 6, textAlign: 'right' },

  // Empty state
  emptyState: { alignItems: 'center' },
  emptyIcon:  { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#444', marginBottom: 8 },
  emptyDesc:  { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 20 },

  // Error state
  errorIcon: { fontSize: 48, marginBottom: 12 },
  errorText: { fontSize: 14, color: '#cc3333', textAlign: 'center', marginBottom: 16 },
  retryBtn: {
    backgroundColor: KU_GREEN,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: { color: '#fff', fontWeight: '700' },

  // Loading
  loadingText: { marginTop: 12, color: '#888', fontSize: 13 },
  noUserText:  { fontSize: 15, color: '#666', textAlign: 'center' },
});
