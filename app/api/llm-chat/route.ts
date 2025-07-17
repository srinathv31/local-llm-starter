export async function POST(req: Request) {
  const { prompt } = await req.json();

  const upstream = await fetch("http://localhost:8000/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
    }),
  });

  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  // stream the response
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
