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
model = AutoModelForCausalLM.from_pretrained(
    model_id,
    torch_dtype=torch.float16,  # Use half precision for speed
    device_map="auto",  # Let transformers handle device placement
    low_cpu_mem_usage=True,  # Reduce memory usage
)

# Enable optimizations
model.eval()  # Set to evaluation mode
if hasattr(model, 'half'):
    model = model.half()  # Use half precision

async def generate(prompt: str):
    # Use a simpler chat template that doesn't include <think> in the input
    inputs = tokenizer.apply_chat_template(
        [
            {"role": "user", "content": prompt}
        ],
        return_tensors="pt"
    ).to(model.device)

    # Use the model's generate method with streaming for better performance
    streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, timeout=10)
    
    # Run generation in a separate thread
    generation_thread = threading.Thread(
        target=model.generate,
        kwargs=dict(
            input_ids=inputs,
            max_new_tokens=256,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
            streamer=streamer,
            use_cache=True,  # Enable KV cache for speed
        ),
        daemon=True
    )
    generation_thread.start()

    # Stream tokens as they're generated
    # Start with the opening <think> tag
    yield f'0:{json.dumps("<think>")}\n'.encode('utf-8')
    
    for token in streamer:
        if token.strip():
            # Ollama format: 0:"token" (JSON string)
            yield f'0:{json.dumps(token)}\n'.encode('utf-8')
            # Small delay to allow other tasks to run
            await asyncio.sleep(0.001)
    
    # Wait for generation to complete
    generation_thread.join()
    
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
    # Enable optimizations for faster inference
    torch.backends.cudnn.benchmark = True  # Optimize for fixed input sizes
    torch.backends.cuda.matmul.allow_tf32 = True  # Use TensorFloat-32 for faster matrix multiplication
    
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        workers=1,  # Single worker for better memory management
        loop="asyncio"
    )
