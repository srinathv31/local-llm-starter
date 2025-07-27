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

async def generate(prompt: str, file_content: str = None):
    # Create a system message that's simpler since we'll force the format
    system_message = "You are a helpful assistant who can analyze files and help with any questions the user has. You may use markdown to format your response."
    
    # Prepare the prompt with file content if available
    if file_content:
        modified_prompt = f"<think>Let me think about this step by step:\n\nFile content:\n{file_content}\n\nUser question: {prompt}\n\nI need to analyze this file content and question carefully and provide a well-reasoned response."
    else:
        # Manually prepend <think> tag but let the model close it naturally
        modified_prompt = f"<think>Let me think about this step by step:\n\n{prompt}\n\nI need to analyze this question carefully and provide a well-reasoned response."
    
    # Use a chat template that includes the system message and user prompt
    inputs = tokenizer.apply_chat_template(
        [
            {"role": "system", "content": system_message},
            {"role": "user", "content": modified_prompt}
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
            max_new_tokens=1024,
            temperature=0.7,
            do_sample=True,
            pad_token_id=tokenizer.eos_token_id,
            streamer=streamer,
            use_cache=True,  # Enable KV cache for speed
        ),
        daemon=True
    )
    generation_thread.start()
    
    # Track the full response and current state
    full_response = ""
    has_sent_reasoning = False
    message_id = "msg-" + "".join([str(ord(c)) for c in str(hash(prompt))[:8]])
    
    # Send message ID first
    yield f'f:{{"messageId":"{message_id}"}}\n'.encode('utf-8')
    
    # Stream tokens as they're generated
    for token in streamer:
        if token.strip():
            full_response += token
            
            # Since we manually prepended <think> tag, we know the format
            # Check if we're still in the thinking phase
            if not has_sent_reasoning:
                # Look for the end of thinking
                thinking_end = full_response.find("</think>")
                if thinking_end != -1:
                    # Thinking is complete, send all thinking content as reasoning
                    thinking_content = full_response[:thinking_end]
                    # Send thinking content as a single chunk with proper JSON escaping
                    if thinking_content.strip():
                        escaped_content = json.dumps(thinking_content)[1:-1]  # Remove outer quotes
                        yield f'g:"{escaped_content}"\n'.encode('utf-8')
                    has_sent_reasoning = True
                    # Send remaining content as response, but skip the </think> tag itself
                    response_content = full_response[thinking_end + 8:]  # 8 = len("</think>")
                    if response_content.strip():
                        # Send response content as 0: prefix with proper JSON escaping
                        escaped_content = json.dumps(response_content)[1:-1]  # Remove outer quotes
                        yield f'0:"{escaped_content}"\n'.encode('utf-8')
                else:
                    # Still in thinking phase, send token as reasoning with proper JSON escaping
                    escaped_token = json.dumps(token)[1:-1]  # Remove outer quotes
                    yield f'g:"{escaped_token}"\n'.encode('utf-8')
            else:
                # Already sent reasoning, now sending response with proper JSON escaping
                escaped_token = json.dumps(token)[1:-1]  # Remove outer quotes
                yield f'0:"{escaped_token}"\n'.encode('utf-8')
            
            # Small delay to allow other tasks to run
            await asyncio.sleep(0.001)
    
    # Wait for generation to complete
    generation_thread.join()
    
    # Send completion signal
    yield f'e:{{"finishReason":"stop","usage":{{"promptTokens":null,"completionTokens":null}},"isContinued":false}}\n'.encode('utf-8')
    yield f'd:{{"finishReason":"stop","usage":{{"promptTokens":null,"completionTokens":null}}}}\n'.encode('utf-8')

@app.post("/llm")
async def llm(body: dict):
    prompt = body.get("prompt", "")
    file_content = body.get("fileContent", None)
    
    async def generate_with_flush():
        async for chunk in generate(prompt, file_content):
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
