import os
import time
from dotenv import load_dotenv
import fitz  # PyMuPDF
from google import genai
from google.genai.errors import APIError
from PIL import Image
import streamlit as st

# โหลดค่า API Key จากไฟล์ .env
load_dotenv(override=True)
client = genai.Client(api_key=os.getenv("GOOGLE_API_KEY"))

# ตั้งค่าหน้าเว็บ Streamlit
st.set_page_config(page_title="KU-advisor", page_icon="🎓")
st.title("🎓 KU-advisor: ที่ปรึกษาทางวิชาการอัจฉริยะ")
st.write("ระบบให้คำปรึกษาหลักสูตรอัตโนมัติ (รองรับหลายไฟล์ PDF ส่วนกลาง)")

# --- ส่วนจัดการโฟลเดอร์หลักสูตรกลางของ Admin ---
ADMIN_DIR = "admin_files"


@st.cache_resource
def load_all_admin_pdfs():
    if not os.path.exists(ADMIN_DIR):
        os.makedirs(ADMIN_DIR)
        return "", []

    pdf_files = [
        f for f in os.listdir(ADMIN_DIR) if f.lower().endswith(".pdf")
    ]
    if not pdf_files:
        return "", []

    all_text = ""
    for pdf_file in pdf_files:
        pdf_path = os.path.join(ADMIN_DIR, pdf_file)
        doc = fitz.open(pdf_path)
        all_text += f"\n=== เอกสาร: {pdf_file} ===\n"
        for page in doc:
            all_text += page.get_text()

    # ตัดความยาวข้อความให้อยู่ในระดับที่ไม่ชน Rate Limit ต่อนาที (ประมาณ 25,000 ตัวอักษร)
    truncated_text = all_text[:25000]
    return truncated_text, pdf_files


# โหลดข้อมูลกลางทั้งหมด
admin_text, loaded_files = load_all_admin_pdfs()

if not loaded_files:
    st.sidebar.error(f"⚠️ ไม่พบไฟล์ PDF ในโฟลเดอร์ `{ADMIN_DIR}`")
    st.stop()
else:
    st.sidebar.success(
        f"✅ โหลดหลักสูตรกลางสำเร็จทั้งหมด {len(loaded_files)} ไฟล์:"
    )
    for f in loaded_files:
        st.sidebar.text(f" - {f}")

# --- ส่วนแนบรูปภาพส่วนตัวของผู้ใช้ ---
st.sidebar.markdown("---")
st.sidebar.header("👤 โหมดข้อมูลส่วนตัวของนิสิต")
uploaded_user_image = st.sidebar.file_uploader(
    "แนบรูปภาพส่วนตัว (เช่น ผลการเรียน/เกรด/ตารางเรียน)",
    type=["png", "jpg", "jpeg"],
)

# --- ระบบหน้าจอแชท ---
if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])
        if "image" in message and message["image"]:
            st.image(
                message["image"], width=250, caption="รูปภาพส่วนตัวที่แนบมา"
            )

if prompt := st.chat_input(
    "พิมพ์คำถามเกี่ยวกับหลักสูตร หรือขอคำปรึกษาทางวิชาการ..."
):
    current_user_image = uploaded_user_image

    st.session_state.messages.append(
        {"role": "user", "content": prompt, "image": current_user_image}
    )

    with st.chat_message("user"):
        st.markdown(prompt)
        if current_user_image:
            st.image(
                current_user_image, width=250, caption="รูปภาพส่วนตัวที่แนบมา"
            )

    with st.chat_message("assistant"):
        with st.spinner("KU-advisor กำลังตรวจสอบหลักสูตร..."):
            contents = [
                "นี่คือเอกสารหลักสูตรกลางทั้งหมดใช้เป็นฐานข้อมูลในการตอบคำถาม:",
                admin_text,
                "คำถามจากนิสิต:",
                prompt,
            ]

            if current_user_image:
                user_img_obj = Image.open(current_user_image)
                contents.append("รูปภาพส่วนตัวที่นิสิตแนบมาประกอบคำถาม:")
                contents.append(user_img_obj)

            try:
                # เรียกใช้ gemini-2.0-flash ซึ่งเป็นโมเดลมาตรฐานของ SDK ใหม่
                response = client.models.generate_content(
                    model="gemini-2.0-flash", contents=contents
                )
                answer = response.text

                st.markdown(answer)
                st.session_state.messages.append(
                    {"role": "assistant", "content": answer, "image": None}
                )

            except APIError as e:
                if "429" in str(e):
                    st.error(
                        "⚠️ ยิงคำถามถี่เกินไปหรือข้อมูลแน่นเกินไปชั่วคราว"
                        " กรุณารอประมาณ 20-30 วินาที แล้วลองพิมพ์ส่งใหม่อีกครั้งครับ"
                    )
                else:
                    st.error(f"เกิดข้อผิดพลาดจาก API: {e}")