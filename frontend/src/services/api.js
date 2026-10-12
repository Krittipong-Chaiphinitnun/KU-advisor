/**
 * src/services/api.js
 * -------------------
 * Axios instance pre-configured for the KU-advisor FastAPI backend.
 *
 * IMPORTANT: Replace YOUR_COMPUTER_IP with your machine's local network IP
 * (e.g. 192.168.1.42) so physical Android/iOS devices on the same Wi-Fi
 * can reach the server. For the Android Emulator use 10.219.145.206 instead.
 */

import axios from 'axios';
import { Platform } from 'react-native';

// ── Base URL ──────────────────────────────────────────────────────────────────
// If running on Web Browser, use localhost:8000. 
// If running on Mobile (iOS/Android), use 192.168.1.100:8000.
export const BASE_URL = Platform.OS === 'web' 
  ? 'http://localhost:8000' 
  : 'https://jolly-stingray-35.loca.lt';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000,         // 120 s (2 mins) — allow ample time for AI RAG responses
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'bypass-tunnel-reminder': 'true',
  },
});
// ── Error Formatter ─────────────────────────────────────────────────────────
export const formatErrorMessage = (err, defaultMsg = 'เกิดข้อผิดพลาดในการเชื่อมต่อ') => {
  if (!err) return defaultMsg;
  let detail = err.response?.data?.detail ?? err.message ?? defaultMsg;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => (typeof d === 'object' && d !== null ? d.msg || JSON.stringify(d) : String(d)))
      .join(', ');
  }
  if (typeof detail === 'object' && detail !== null) {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
};

// ── Auth ──────────────────────────────────────────────────────────────────────

/** Register a new student account */
export const registerUser = ({ student_id, password, full_name, email = null, role = 'student' }) =>
  api.post('/api/auth/register', { student_id, password, full_name, email, role });

/** Authenticate and get back the user object */
export const loginUser = ({ student_id, password }) =>
  api.post('/api/auth/login', { student_id, password });

// ── Chat ──────────────────────────────────────────────────────────────────────

/**
 * Send a chat message (with optional image) to the AI advisor.
 *
 * @param {object} params
 * @param {string}          params.prompt     - Student question text
 * @param {number|null}     params.user_id    - DB user.id (enables history saving)
 * @param {{ uri, name, fileName, type, mimeType, base64 }|null} params.image - Image asset from expo-image-picker
 */
export const sendChatMessage = async ({ prompt, user_id = null, image = null }) => {
  const form = new FormData();
  form.append('prompt', prompt);
  if (user_id !== null) form.append('user_id', String(user_id));

  if (image) {
    if (image.base64) {
      form.append('image_base64', image.base64);
    }

    const fileName = image.name || image.fileName || 'transcript.jpg';
    const mimeType = image.type || image.mimeType || 'image/jpeg';

    if (Platform.OS === 'web') {
      try {
        if (image.uri && (image.uri.startsWith('blob:') || image.uri.startsWith('data:'))) {
          const res = await fetch(image.uri);
          const blob = await res.blob();
          form.append('image_file', blob, fileName);
        } else if (image.file) {
          form.append('image_file', image.file, fileName);
        }
      } catch (e) {
        console.warn('Could not convert web image to Blob:', e);
      }
    } else {
      form.append('image_file', {
        uri: image.uri,
        name: fileName,
        type: mimeType,
      });
    }
  }

  return api.post('/api/chat', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── History ───────────────────────────────────────────────────────────────────

/** Fetch all advising sessions + messages for a user */
export const fetchHistory = (user_id) =>
  api.get(`/api/history/${user_id}`);

// ── RAG Status ────────────────────────────────────────────────────────────────

/** Returns loaded PDF files and context character count */
export const fetchStatus = () => api.get('/api/status');

export default api;
