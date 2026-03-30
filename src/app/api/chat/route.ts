import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const SYSTEM_PROMPT = `Você é o assistente de IA da DentFlow, uma clínica odontológica em Fortaleza, Ceará. Você ajuda a Dra. a gerenciar sua clínica respondendo perguntas sobre pacientes, finanças, estoque e retornos.

Dados da clínica (resumo atualizado):

PACIENTES: 263 cadastrados.
- Planos: Particular (109), Uniodonto (98), Camed (34), Geap (22)
- 55 prontuários desatualizados
- Exemplo de paciente: Wilmar Helena de Alencar Cunha Monteiro (F, 1934, tel: 85 988095644, plano Geap, alérgica a iodo, pressão alta, diabetes)
- Ana Beatriz Fernandes Ramos (F, 1990, tel: 85 991234567, Particular, clareamento)
- Carlos Eduardo Silva Mendes (M, 1985, tel: 85 999876543, Uniodonto)

FINANCEIRO (2025):
- Receita total: R$ 72.877,23
- Lucro líquido: R$ 40.485,86 (margem ~55%)
- Melhor mês: Junho (R$ 7.410,19 lucro, margem 62.2%)
- Receita mensal média: ~R$ 6.073
- Modalidades: Particular, Uniodonto, Camed, Geap
- DRE inclui INSS, IR, custo máquina de crédito, custo dos procedimentos

ATENDIMENTOS: 1.135 no total, 454 com dados completos no sistema

ESTOQUE (alertas críticos):
- Mepivacaína: 3 unidades (validade Ago/2025)
- Hipoclorito de Sódio: 2 unidades (OK até Jan/2026)
- Pasta Profilática: 1 unidade (validade Dez/2025)

RETORNOS PENDENTES:
- Ana Paula Vaz da Silva — 1 mês e 12 dias (Uniodonto)
- Carlos Eduardo Silva Mendes — 3 meses e 5 dias (Uniodonto)
- Maria José Santos — 6 meses (Particular)

GOOGLE SHEETS: Integração configurada. As abas são: Prontuário, Atendimentos, DFC (fluxo de caixa), Estoque, Retornos, Tabela de Preços, Backups.

INSTRUÇÕES:
- Responda sempre em português do Brasil
- Seja conciso, útil e profissional
- Use formatação markdown (negrito, listas) quando adequado
- Se não tiver certeza de algo, diga que precisaria verificar os dados em tempo real
- Quando relevante, sugira ações práticas (ex: "Quer que eu prepare a mensagem de WhatsApp?")
- Use emojis com moderação para facilitar a leitura`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY não configurada' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Campo messages é obrigatório' }, { status: 400 });
    }

    const groq = new Groq({ apiKey });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages.map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      ],
      max_tokens: 1024,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 'Não consegui gerar uma resposta.';
    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Groq API error:', error);
    return NextResponse.json({ error: error.message || 'Erro ao chamar a API de IA' }, { status: 500 });
  }
}
