import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import threading

from query import load_index, retrieve
from generate import generate_grounded_answer

class RAG_GUI:
    def __init__(self, root):
        self.root = root
        self.root.title("المساعد الطبي الذكي (RAG)")
        self.root.geometry("800x600")
        
        self.vectordb = None
        
        # UI Elements
        self.lbl_question = ttk.Label(root, text="اكتب سؤالك الطبي هنا:", font=("Arial", 12))
        self.lbl_question.pack(pady=10)
        
        self.entry_question = ttk.Entry(root, width=70, font=("Arial", 12))
        self.entry_question.pack(pady=5)
        
        self.btn_search = ttk.Button(root, text="بحث 🔍", command=self.on_search)
        self.btn_search.pack(pady=10)
        
        self.lbl_status = ttk.Label(root, text="جاري تحميل قاعدة البيانات... برجاء الانتظار", foreground="blue", font=("Arial", 10))
        self.lbl_status.pack(pady=5)
        
        self.txt_result = scrolledtext.ScrolledText(root, wrap=tk.WORD, width=90, height=20, font=("Arial", 11))
        self.txt_result.pack(pady=10, padx=10, fill=tk.BOTH, expand=True)
        
        # Load DB in background
        threading.Thread(target=self.load_db, daemon=True).start()

    def load_db(self):
        try:
            self.vectordb = load_index()
            self.root.after(0, lambda: self.lbl_status.config(text="✅ النظام جاهز لاستقبال أسئلتك!", foreground="green"))
        except Exception as e:
            self.root.after(0, lambda: self.lbl_status.config(text=f"❌ خطأ في التحميل: {e}", foreground="red"))

    def on_search(self):
        question = self.entry_question.get().strip()
        if not question:
            messagebox.showwarning("تنبيه", "من فضلك اكتب سؤال أولاً.")
            return
            
        if not self.vectordb:
            messagebox.showwarning("تنبيه", "برجاء الانتظار حتى يتم تحميل قاعدة البيانات.")
            return

        self.btn_search.config(state=tk.DISABLED)
        self.lbl_status.config(text="⏳ جاري البحث وتوليد الإجابة... برجاء الانتظار (قد يستغرق بضع ثواني)", foreground="blue")
        self.txt_result.delete(1.0, tk.END)
        
        # Run search in background to prevent freezing UI
        threading.Thread(target=self.search_task, args=(question,), daemon=True).start()

    def search_task(self, question):
        try:
            results = retrieve(self.vectordb, question)
            answer = generate_grounded_answer(question, results)
            
            # Format output
            output = "💡 الإجابة (Recommendation):\n"
            output += "---------------------------\n"
            output += answer.get("recommendation", "لا توجد إجابة.") + "\n\n"
            
            output += "📜 الدليل (Evidence):\n"
            output += "---------------------------\n"
            output += answer.get("evidence", "لا يوجد دليل متاح.") + "\n\n"
            
            output += f"📊 مستوى الثقة: {answer.get('confidence', 'unknown').capitalize()}\n\n"
            
            output += "📚 المراجع (Citations):\n"
            output += "---------------------------\n"
            citations = answer.get("citations", [])
            if citations:
                for i, cit in enumerate(citations, 1):
                    doc = cit.get("document", "N/A")
                    page = cit.get("page", "N/A")
                    output += f"{i}. مستند: {doc} - صفحة: {page}\n"
            else:
                output += "لا توجد مراجع."
                
            self.root.after(0, self.update_result, output)
        except Exception as e:
            self.root.after(0, self.update_result, f"حدث خطأ أثناء البحث:\n{e}")
            
    def update_result(self, text):
        self.txt_result.insert(tk.END, text)
        self.lbl_status.config(text="✅ تمت الإجابة بنجاح!", foreground="green")
        self.btn_search.config(state=tk.NORMAL)

if __name__ == "__main__":
    root = tk.Tk()
    app = RAG_GUI(root)
    root.mainloop()
