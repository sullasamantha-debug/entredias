# Rendimento deve entrar como receita, não despesa

## O problema

No leitor de extrato PDF, quando a linha não traz marca de crédito/débito (C/D, sinal
negativo ou saldo confiável), o tipo é decidido por palavras-chave. A lista de palavras
de entrada exige a palavra exata "rendimento" isolada, então formas muito comuns não são
reconhecidas: "Rendimentos", "Rendimento pago", "Rend.", "Remuneração", "Juros",
"Dividendos", "Cashback". Sem reconhecimento, a linha cai no padrão **Despesa** e aparece
na conferência pedindo categoria.

## O que será ajustado

1. **Reconhecer rendimento e afins como entrada**: rendimento/rendimentos, "rend."/"rend
   pago", remuneração, juros, dividendos, cashback, correção monetária, além dos termos já
   existentes (crédito, recebido, depósito, estorno, reembolso, salário).
2. **Sugerir a categoria "Rendimentos"** para essas linhas, como já acontece na importação
   OFX, para não pedir classificação manual.
3. **Mesma regra na importação OFX**, mantendo os dois leitores com o mesmo vocabulário.

Nada muda na regra de aplicações/resgates: rendimento continua sendo receita da conta e
não aporte em reserva/investimento.

## Detalhes técnicos

- `src/lib/pdf-statement.ts`: ampliar `CREDIT_HINTS` (rendimento(s), `rend\.?`, remunera,
  juros, dividendo, cashback, corre[çc][ãa]o monet) sem alterar a ordem de resolução do
  tipo; manter prioridade de C/D, sinal e saldo.
- `src/lib/ofx.ts`: alinhar a regra de sugestão `Rendimentos` com os mesmos termos.
- Sem mudanças de banco de dados nem na tela de conferência.
