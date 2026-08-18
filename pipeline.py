import os
import json
import sys

import config
from query import load_index, retrieve, print_results
from generate import generate_grounded_answer

def main():
    if len(sys.argv) < 2:
        print('Usage: python pipeline.py "your question here"')
        print('Example: python pipeline.py "What is the target blood pressure?"')
        sys.exit(1)

    question = " ".join(sys.argv[1:])
    print(f"Question: {question}\n")

    print("Loading index...")
    vectordb = load_index()

    print("Retrieving context...")
    results = retrieve(vectordb, question)
    print_results(results)

    print("\nGenerating grounded answer...")
    answer = generate_grounded_answer(question, results)
    
    print("\n" + "="*50)
    print("FINAL ANSWER (JSON):")
    print("="*50)
    print(json.dumps(answer, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()