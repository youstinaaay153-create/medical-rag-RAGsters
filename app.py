import streamlit as st
import json

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

# صندوق إدخال السؤال
question = st.text_input("اكتب سؤالك هنا:", placeholder="مثال: What is the target blood pressure?")

if st.button("بحث 🔍"):
    if not question.strip():
        st.warning("من فضلك اكتب سؤال الأول.")
    else:
        with st.spinner("جاري البحث في المستندات الطبية..."):
            results = retrieve(vectordb, question)
        
        with st.spinner("جاري تحليل الإجابة وتوليدها..."):
            answer = generate_grounded_answer(question, results)
        
        # عرض الإجابة
        st.subheader("💡 الإجابة (Recommendation)")
        st.info(answer.get("recommendation", "لا توجد إجابة."))
        
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
