# Transferência em linhas de receita: conta escolhida é a de origem

## O problema (confirmado no código)

Na conferência da importação de extrato (OFX e PDF), quando uma linha é marcada como
"Transferência entre contas", o sistema sempre grava a conta do extrato como **origem** e a
conta escolhida no seletor como **destino** — independentemente de o valor ter entrado ou
saído da conta.

Numa linha de **entrada** (crédito), o dinheiro chega na conta do extrato, então a conta
escolhida é quem **enviou** o valor. Hoje isso é gravado invertido, o que inverte o saldo
diário e o saldo da conta.

O formulário manual de Novo registro já está correto (pergunta "De" e "Para"
explicitamente), então não muda.

## O que será ajustado

1. **Sentido correto da transferência na importação (OFX e PDF)**
   - Linha de saída (débito): conta do extrato = origem, conta escolhida = destino (como hoje).
   - Linha de entrada (crédito): conta escolhida = origem, conta do extrato = destino.

2. **Rótulo do seletor conforme o sentido**
   - Em linhas de entrada: "Conta de origem…" (quem enviou).
   - Em linhas de saída: "Conta destino…" (quem recebeu).
   - Texto de apoio mostrando o caminho, ex. "Inter → Itaú".

Nada mais muda: reservas, investimentos, pagamento de fatura, categorias e o saldo diário
continuam com a mesma lógica — apenas passam a receber o sentido certo.

## Detalhes técnicos

- `src/components/OFXImport.tsx` (linha ~234) e `src/components/PDFImport.tsx` (linha ~231):
  ao montar a linha de `finances` para `kind === "transfer"`, definir
  `account_id`/`to_account_id` de acordo com `r.type`:
  - `DEBIT` → `account_id: account.id`, `to_account_id: r.toAccountId`
  - `CREDIT` → `account_id: r.toAccountId`, `to_account_id: account.id`
- Ajustar o `<select>` de conta (OFX ~380, PDF ~366) para trocar o rótulo por sentido e
  exibir o caminho origem → destino.
- `dailyBalances` em `src/lib/finance.ts` já debita `account_id` e credita `to_account_id`,
  então o saldo diário e o saldo da conta passam a fechar sem outras mudanças.
- Registros antigos importados com o sentido invertido não são corrigidos automaticamente;
  se quiser, posso adicionar depois uma correção pontual desses lançamentos.
