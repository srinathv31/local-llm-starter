from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
import torch, json, threading
import uvicorn

app = FastAPI()
model_id = '/Users/srinathvenkatesh/Documents/CodeProjects/AI/models/DeepSeek-R1-Distill-Qwen-1.5B'

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id).to("cuda" if torch.cuda.is_available() else "cpu")

async def generate(prompt: str):
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True)

    inputs = tokenizer.apply_chat_template(
        [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        return_tensors="pt"
    ).to(model.device)

    # launch generation in a background thread
    threading.Thread(
        target=model.generate,
        kwargs=dict(
            input_ids=inputs,
            max_new_tokens=256,
            temperature=0.7,
            pad_token_id=tokenizer.eos_token_id,
            streamer=streamer,
        ),
        daemon=True
    ).start()

    # stream the tokens
    for tok in streamer:
        # Server-Sent Events framing
        if tok.strip():
            yield f'0:{json.dumps(tok)}\n'.encode('utf-8')
        yield b"d:{\"finishReason\":\"stop\"}\n\n"

@app.post("/llm")
async def llm(body: dict):
    return StreamingResponse(
        generate(body["prompt"]),
        media_type="text/event-stream",
        headers={
            "x-vercel-ai-data-stream": "v1"
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
