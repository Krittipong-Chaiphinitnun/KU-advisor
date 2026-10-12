/**
 * src/screens/ChatScreen.js
 * -------------------------
 * Real-time AI chat with message bubbles, image upload, and loading states.
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { formatErrorMessage, sendChatMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';

const KU_GREEN      = '#006633';
const KU_GREEN_DARK = '#004d26';
const KU_GOLD       = '#C9A84C';

// ── Message bubble component ──────────────────────────────────────────────────
function MessageBubble({ item }) {
  const isUser = item.sender === 'user';
  return (
    <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>🎓</Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          isUser ? styles.bubbleUser : styles.bubbleAI,
        ]}
      >
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.bubbleImage} resizeMode="cover" />
        )}
        <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextAI]}>
          {item.text}
        </Text>
        <Text style={styles.bubbleTime}>{item.time}</Text>
      </View>
      {isUser && (
        <View style={styles.userAvatar}>
          <Text style={styles.userAvatarText}>👤</Text>
        </View>
      )}
    </View>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow, styles.bubbleRowAI]}>
      <View style={styles.aiAvatar}>
        <Text style={styles.aiAvatarText}>🎓</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <ActivityIndicator size="small" color={KU_GREEN} />
        <Text style={styles.typingText}>KU-advisor กำลังคิด...</Text>
      </View>
    </View>
  );
}

let _msgId = 0;
const newId = () => `msg_${++_msgId}`;
const timeNow = () =>
  new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

export default function ChatScreen() {
  const { user } = useAuth();
  const flatRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: newId(),
      sender: 'ai',
      text: `สวัสดีครับ${user?.full_name ? ' คุณ' + user.full_name : ''}! 🎓\nผมคือ KU-advisor ช่วยให้คำปรึกษาเรื่องหลักสูตรและการวางแผนการเรียนครับ\n\nจะถามอะไรได้เลยครับ!`,
      time: timeNow(),
    },
  ]);
  const [inputText, setInputText]   = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [isLoading, setIsLoading]   = useState(false);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  // ── Pick image ───────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'ต้องอนุญาตการเข้าถึงรูปภาพก่อนครับ');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPendingImage(result.assets[0]);
    }
  };

  const clearImage = () => setPendingImage(null);

  // ── Send message ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text && !pendingImage) return;
    if (isLoading) return;

    const userMsg = {
      id: newId(),
      sender: 'user',
      text: text || '(ส่งรูปภาพ)',
      image: pendingImage?.uri ?? null,
      time: timeNow(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setPendingImage(null);
    setIsLoading(true);
    scrollToBottom();

    try {
      const res = await sendChatMessage({
        prompt: text || 'วิเคราะห์รูปภาพผลการเรียนที่แนบมานี้',
        user_id: user?.id ?? user?.user_id ?? null,
        image: pendingImage,
      });

      const aiMsg = {
        id: newId(),
        sender: 'ai',
        text: res.data.reply,
        time: timeNow(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const isRateLimit = err.response?.status === 429;
      const errorDetail = formatErrorMessage(err);
      const errMsg = {
        id: newId(),
        sender: 'ai',
        text: isRateLimit
          ? '⚠️ ยิงคำถามถี่เกินไปชั่วคราว กรุณารอ 20-30 วินาที แล้วลองใหม่ครับ'
          : `❌ เกิดข้อผิดพลาด: ${errorDetail}`,
        time: timeNow(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={90}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>🎓</Text>
        <View>
          <Text style={styles.headerTitle}>KU-advisor</Text>
          <Text style={styles.headerSub}>AI Academic Advisor · Gemini 3.6 Flash</Text>
        </View>
      </View>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble item={item} />}
        contentContainerStyle={styles.messageList}
        onContentSizeChange={scrollToBottom}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={isLoading ? <TypingIndicator /> : null}
      />

      {/* ── Pending image preview ───────────────────────────────────────── */}
      {pendingImage && (
        <View style={styles.imagePreviewBar}>
          <Image source={{ uri: pendingImage.uri }} style={styles.imageThumb} />
          <Text style={styles.imagePreviewText} numberOfLines={1}>
            {pendingImage.fileName ?? 'รูปภาพที่เลือก'}
          </Text>
          <TouchableOpacity onPress={clearImage} style={styles.imageRemoveBtn}>
            <Text style={styles.imageRemoveText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Input bar ──────────────────────────────────────────────────── */}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.attachBtn} onPress={handlePickImage}>
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="พิมพ์คำถามเกี่ยวกับหลักสูตร..."
          placeholderTextColor="#aaa"
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />

        <TouchableOpacity
          style={[styles.sendBtn, (!inputText.trim() && !pendingImage) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={isLoading || (!inputText.trim() && !pendingImage)}
        >
          <Text style={styles.sendIcon}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f7f3' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KU_GREEN_DARK,
    paddingTop: Platform.OS === 'ios' ? 54 : 14,
    paddingBottom: 14,
    paddingHorizontal: 18,
    gap: 12,
  },
  headerIcon:  { fontSize: 28 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  headerSub:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  // Message list
  messageList: { paddingHorizontal: 14, paddingVertical: 12, paddingBottom: 8 },

  // Bubble row
  bubbleRow:     { flexDirection: 'row', marginVertical: 6, alignItems: 'flex-end' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start' },

  // Avatars
  aiAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: KU_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  aiAvatarText:   { fontSize: 16 },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: KU_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  userAvatarText: { fontSize: 16 },

  // Bubbles
  bubble: {
    maxWidth: '75%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleUser: {
    backgroundColor: KU_GREEN,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  bubbleText:     { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAI:   { color: '#222' },
  bubbleTime: {
    fontSize: 10,
    color: 'rgba(150,150,150,0.9)',
    marginTop: 5,
    textAlign: 'right',
  },
  bubbleImage: {
    width: 200,
    height: 140,
    borderRadius: 10,
    marginBottom: 8,
  },

  // Typing indicator
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 10,
  },
  typingText: { fontSize: 13, color: '#666' },

  // Image preview bar
  imagePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f4ee',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#d0e8d8',
    gap: 10,
  },
  imageThumb:        { width: 42, height: 42, borderRadius: 8 },
  imagePreviewText:  { flex: 1, fontSize: 12, color: '#444' },
  imageRemoveBtn:    { padding: 4 },
  imageRemoveText:   { fontSize: 16, color: '#cc3333' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e8e0',
    paddingBottom: Platform.OS === 'ios' ? 28 : 10,
    gap: 8,
  },
  attachBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f4f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachIcon: { fontSize: 20 },
  textInput: {
    flex: 1,
    backgroundColor: '#f5f8f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#222',
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#dde8dd',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: KU_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: KU_GREEN,
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: '#b0c8b8', shadowOpacity: 0 },
  sendIcon: { color: '#fff', fontSize: 16, marginLeft: 2 },
});
