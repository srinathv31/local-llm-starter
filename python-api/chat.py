from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
import torch, json, threading
import uvicorn
import asyncio

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model_id = '/Users/srinathvenkatesh/Documents/CodeProjects/AI/models/DeepSeek-R1-Distill-Qwen-1.5B'

tokenizer = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForCausalLM.from_pretrained(model_id).to("cuda" if torch.cuda.is_available() else "cpu")

async def generate(prompt: str):
    inputs = tokenizer.apply_chat_template(
        [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt}
        ],
        return_tensors="pt"
    ).to(model.device)

    # Generate tokens one by one for real-time streaming
    generated_ids = []
    for _ in range(256):  # max_new_tokens
        # Get the next token
        with torch.no_grad():
            outputs = model(input_ids=torch.cat([inputs, torch.tensor([generated_ids]).to(model.device)], dim=1) if generated_ids else inputs)
            next_token_logits = outputs.logits[:, -1, :]
            next_token = torch.multinomial(torch.softmax(next_token_logits / 0.7, dim=-1), num_samples=1)
            generated_ids.append(next_token.item())
        
        # Decode the token
        token = tokenizer.decode([next_token.item()], skip_special_tokens=False)
        
        # Skip special tokens and empty tokens
        if token.strip():
            # Ollama format: 0:"token" (JSON string)
            yield f'0:{json.dumps(token)}\n'.encode('utf-8')
            # Force immediate flush
            await asyncio.sleep(0)
        
        # Check for end of generation
        if next_token.item() == tokenizer.eos_token_id:
            break
    
    # Send completion signal
    yield f'e:{{"finishReason":"stop"}}\n'.encode('utf-8')
    yield f'd:{{"finishReason":"stop"}}\n'.encode('utf-8')

@app.post("/llm")
async def llm(body: dict):
    async def generate_with_flush():
        async for chunk in generate(body["prompt"]):
            yield chunk
            # Force immediate flush
            await asyncio.sleep(0)
    
    return StreamingResponse(
        generate_with_flush(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
