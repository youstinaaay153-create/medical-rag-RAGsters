import streamlit as st
import json
import re
from io import BytesIO
from gtts import gTTS

from query import load_index, retrieve
from generate import generate_grounded_answer

# إعدادات الصفحة
st.set_page_config(page_title="المساعد الطبي RAG", page_icon="🩺", layout="centered")

st.title("🩺 المساعد الطبي الذكي (RAG)")
st.markdown("تقدر تسأل أي سؤال طبي، والبرنامج هيبحث في المستندات المعتمدة ويجاوبك.")

# تحميل البيانات مرة واحدة بس لتسريع البرنامج
@st.cache_resource
def get_vectordb():
    return load_index()

try:
    vectordb = get_vectordb()
except Exception as e:
    st.error("مشكلة في تحميل البيانات. اتأكد إنك عملت ingest.py الأول.")
    st.stop()

@st.cache_data(show_spinner=False)
def get_answer(_db, q, is_layman):
    res = retrieve(_db, q)
    return generate_grounded_answer(q, res, layman_terms=is_layman)

# صندوق إدخال السؤال
question = st.text_input("اكتب سؤالك هنا:", placeholder="مثال: What is the target blood pressure?")
layman_terms = st.checkbox("تبسيط الإجابة (لغير الأطباء)", value=False)

if st.button("بحث 🔍"):
    if not question.strip():
        st.warning("من فضلك اكتب سؤال الأول.")
    else:
        with st.spinner("جاري البحث في المستندات الطبية وتوليد الإجابة (يرجى الانتظار)..."):
            answer = get_answer(vectordb, question, layman_terms)
        
        # عرض الإجابة
        st.subheader("💡 الإجابة (Recommendation)")
        recommendation = answer.get("recommendation", "لا توجد إجابة.")
        st.info(recommendation)
        
        # إضافة الصوت
        if recommendation and answer.get("confidence") != "insufficient":
            with st.spinner("جاري تحضير المقطع الصوتي..."):
                try:
                    is_arabic = bool(re.search('[\u0600-\u06FF]', recommendation))
                    tts_lang = 'ar' if is_arabic else 'en'
                    tts = gTTS(text=recommendation, lang=tts_lang)
                    fp = BytesIO()
                    tts.write_to_fp(fp)
                    st.audio(fp, format="audio/mp3")
                except Exception as e:
                    st.error("لم نتمكن من توليد المقطع الصوتي.")
        
        # عرض الدليل
        st.subheader("📜 الدليل من المستند (Evidence)")
        st.write(answer.get("evidence", "لا يوجد دليل متاح."))
        
        # عرض مستوى الثقة
        confidence = answer.get("confidence", "unknown")
        if confidence == "high":
            st.success(f"مستوى الثقة في الإجابة: عالي (High)")
        elif confidence == "medium":
            st.warning(f"مستوى الثقة في الإجابة: متوسط (Medium)")
        else:
            st.error(f"مستوى الثقة في الإجابة: منخفض/غير كافي ({confidence})")
            
        # المراجع
        with st.expander("📚 المراجع والمصادر (Citations)"):
            citations = answer.get("citations", [])
            if citations:
                for i, cit in enumerate(citations, 1):
                    doc = cit.get("document", "غير معروف")
                    page = cit.get("page", "غير معروف")
                    st.markdown(f"**{i}.** مستند: `{doc}` - صفحة: `{page}`")
            else:
                st.write("لا توجد مراجع.")
