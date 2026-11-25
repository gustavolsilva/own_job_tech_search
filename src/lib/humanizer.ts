/**
 * Pós-processador inspirado na skill `humanizer`:
 * Remove padrões artificiais comuns em textos gerados por IA (travessões excessivos,
 * frases clichês de abertura/fechamento e palavras superinfladas).
 */
export function humanizePitchText(raw: string): string {
  let text = raw.trim();

  // Remove saudações/resíduos de chatbot
  text = text.replace(/^(Claro!|Com certeza!|Aqui está[^:]*:|Certainly!|Here is[^:]*:)\s*/i, "");

  // Substitui travessões (— / –) por vírgulas ou pontos
  text = text.replace(/\s*[—–]\s*/g, ", ");

  // Remove aberturas encenadas comuns
  text = text.replace(
    /\b(Let's dive in|Without further ado|Sem mais delongas|Vale ressaltar que|Em um cenário em constante evolução)[,.!]?\s*/gi,
    ""
  );

  // Suaviza palavras clichês de IA em EN/PT
  const replacements: Array<[RegExp, string]> = [
    [/\bdelve into\b/gi, "explore"],
    [/\btestament to\b/gi, "proof of"],
    [/\bpivotal\b/gi, "important"],
    [/\brobust\b/gi, "solid"],
    [/\bseamless(ly)?\b/gi, "smooth$1"],
    [/\bdesempenha um papel crucial\b/gi, "ajuda diretamente"],
    [/\bimpulsionar resultados\b/gi, "gerar resultados"],
  ];

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement);
  }

  // Normaliza espaços e quebras excessivas
  text = text.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

