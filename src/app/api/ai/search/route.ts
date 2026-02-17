import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

const SYSTEM_PROMPT = `Voce e um especialista em bancos de dados SQL. Responda SEMPRE em portugues brasileiro.

Voce domina:
- PostgreSQL (todas as versoes, incluindo extensoes como pg_trgm, PostGIS, etc.)
- MySQL (5.7+ e 8.0+)
- MariaDB (10.x e 11.x)
- Supabase (PostgreSQL com extras)

Regras:
1. Responda de forma objetiva e pratica com exemplos de codigo SQL
2. Quando a pergunta envolve diferencas entre bancos, mostre exemplos para CADA um
3. Use formatacao Markdown com blocos de codigo SQL (\`\`\`sql)
4. Inclua comentarios nos exemplos explicando cada parte
5. Se relevante, mencione performance, boas praticas e armadilhas comuns
6. Sempre indique se um recurso e exclusivo de um banco especifico
7. Mantenha respostas concisas mas completas`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Perplexity API key not configured" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { question } = body;

    if (!question || typeof question !== "string" || question.trim().length < 3) {
      return NextResponse.json(
        { error: "A pergunta deve ter pelo menos 3 caracteres" },
        { status: 400 }
      );
    }

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: question.trim() },
        ],
        max_tokens: 2048,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("[api/ai/search] Perplexity error:", response.status, errorData);
      return NextResponse.json(
        { error: `Perplexity API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    const answer = data.choices?.[0]?.message?.content ?? "Sem resposta.";
    const citations = data.citations ?? [];

    return NextResponse.json({
      answer,
      citations,
      model: data.model,
    });
  } catch (error) {
    console.error("[api/ai/search] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
