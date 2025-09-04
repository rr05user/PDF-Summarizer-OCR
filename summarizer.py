from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline

def load_llama_summarizer():
    model_id = "meta-llama/Llama-3.2-1B"
    tokenizer = AutoTokenizer.from_pretrained(model_id, use_auth_token=True)
    model = AutoModelForCausalLM.from_pretrained(model_id, use_auth_token=True)
    
    generator = pipeline("text-generation", model=model, tokenizer=tokenizer)
    return generator

summarizer = load_llama_summarizer()

def summarize_text(text):
    prompt = f"Summarize this receipt or document:\n{text}\nSummary:"
    result = summarizer(prompt, max_new_tokens=150, do_sample=False)
    return result[0]["generated_text"].split("Summary:")[-1].strip()
