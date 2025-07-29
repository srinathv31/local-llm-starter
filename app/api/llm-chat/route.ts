export async function POST(req: Request) {
  const { prompt, fileContent } = await req.json();

  // Mock response for "Hello" prompt
  if (prompt.trim() === "Hello") {
    const mockResponse = [
      'f:{"messageId":"msg-4557495453565348"}',
      'g:"First, "',
      'g:"I\'ll "',
      'g:"read "',
      'g:"the "',
      'g:"question "',
      'g:"to "',
      'g:"understand "',
      'g:"what "',
      'g:"is "',
      'g:"being "',
      'g:"asked. "',
      'g:"Then, "',
      'g:"I\'ll "',
      'g:"break "',
      'g:"it "',
      'g:"down "',
      'g:"into "',
      'g:"smaller "',
      'g:"parts "',
      'g:"to "',
      'g:"tackle "',
      'g:"each "',
      'g:"component "',
      'g:"individually. "',
      'g:"I\'ll "',
      'g:"consider "',
      'g:"any "',
      'g:"background "',
      'g:"information "',
      'g:"that "',
      'g:"might "',
      'g:"be "',
      'g:"relevant "',
      'g:"and "',
      'g:"ensure "',
      'g:"that "',
      'g:"I "',
      'g:"address "',
      'g:"potential "',
      'g:"ambiguities "',
      'g:"or "',
      'g:"unclear "',
      'g:"points "',
      'g:"in "',
      'g:"the "',
      'g:"question. "',
      'g:"By "',
      'g:"systematically "',
      'g:"analyzing "',
      'g:"each "',
      'g:"part, "',
      'g:"I\'ll "',
      'g:"be "',
      'g:"able "',
      'g:"to "',
      'g:"provide "',
      'g:"a "',
      'g:"comprehensive "',
      'g:"and "',
      'g:"accurate "',
      'g:"answer. "',
      'g:"I\'ll "',
      'g:"also "',
      'g:"keep "',
      'g:"in "',
      'g:"mind "',
      'g:"the "',
      'g:"tone "',
      'g:"and "',
      'g:"style "',
      'g:"that "',
      'g:"would "',
      'g:"be "',
      'g:"most "',
      'g:"appropriate "',
      'g:"for "',
      'g:"the "',
      'g:"user\'s "',
      'g:"context, "',
      'g:"whether "',
      'g:"that\'s "',
      'g:"professional "',
      'g:"or "',
      'g:"personal. "',
      'g:"Additionally, "',
      'g:"I\'ll "',
      'g:"review "',
      'g:"my "',
      'g:"thought "',
      'g:"process "',
      'g:"to "',
      'g:"make "',
      'g:"sure "',
      'g:"there "',
      'g:"are "',
      'g:"no "',
      'g:"errors "',
      'g:"or "',
      'g:"misinterpretations. "',
      'g:"Overall, "',
      'g:"my "',
      'g:"goal "',
      'g:"is "',
      'g:"to "',
      'g:"ensure "',
      'g:"that "',
      'g:"my "',
      'g:"analysis "',
      'g:"is "',
      'g:"thorough, "',
      'g:"clear, "',
      'g:"and "',
      'g:"helpful "',
      'g:"for "',
      'g:"the "',
      'g:"user.\\n"',
      "g:\"First, I'll read the question to understand what is being asked. Then, I'll break it down into smaller parts to tackle each component individually. I'll consider any background information that might be relevant and ensure that I address potential ambiguities or unclear points in the question. By systematically analyzing each part, I'll be able to provide a comprehensive and accurate answer. I'll also keep in mind the tone and style that would be most appropriate for the user's context, whether that's professional or personal. Additionally, I'll review my thought process to make sure there are no errors or misinterpretations. Overall, my goal is to ensure that my analysis is thorough, clear, and helpful for the user.\\n\"",
      '0:"Certainly! "',
      '0:"Please "',
      '0:"provide "',
      '0:"the "',
      '0:"question "',
      '0:"you\'d "',
      '0:"like "',
      '0:"me "',
      '0:"to "',
      '0:"analyze, "',
      '0:"and "',
      '0:"I\'ll "',
      '0:"do "',
      '0:"so "',
      '0:"step "',
      '0:"by "',
      '0:"step, "',
      '0:"ensuring "',
      '0:"clarity "',
      '0:"and "',
      '0:"thoroughness.<\\uff5cend\\u2581of\\u2581sentence\\uff5c>"',
      'e:{"finishReason":"stop","usage":{"promptTokens":null,"completionTokens":null},"isContinued":false}',
      'd:{"finishReason":"stop","usage":{"promptTokens":null,"completionTokens":null}}',
    ];

    // Create a stream that yields the mock response with delays
    const stream = new ReadableStream({
      async start(controller) {
        for (const chunk of mockResponse) {
          controller.enqueue(new TextEncoder().encode(chunk + "\n"));
          // Add a small delay to simulate streaming
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const upstream = await fetch("http://localhost:8000/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      fileContent,
    }),
  });

  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  // Create a custom stream that reads from the Python backend
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) {
        controller.close();
        return;
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Pass through the AI SDK format directly
          controller.enqueue(value);
        }
      } catch (error) {
        controller.error(error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
