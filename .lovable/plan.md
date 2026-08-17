# Finanças: aplicações/resgates + saldo diário no extrato (continuação)

A base já existe: detecção de aplicações/resgates (`src/lib/patrimony.ts`), tabela de histórico de investimentos com vínculo de conta, e a importação de PDF já marca cada linha com "possível aplicação" e permite escolher o tipo (aporte/resgate em reserva ou investimento). Falta fechar o ciclo: gravar os efeitos, mostrar origem/destino no extrato, e o saldo do dia.

## 1. Concluir a importação (PDF e OFX)

- Na tela de conferência, quando a linha for aporte/resgate, exibir um seletor de destino: reservas e investimentos já cadastrados, ou "criar novo" com o nome digitado. Aviso visível quando o destino ainda não foi escolhido (a linha não é importada como aplicação sem destino).
- Ao confirmar a importação:
  - criar/resolver o destino escolhido;
  - lançar a movimentação na conta como **Transferência patrimonial** (saída no aporte, entrada no resgate) — sem entrar em receita nem despesa;
  - atualizar o saldo da reserva ou do investimento;
  - gravar no histórico da reserva/investimento o valor, a data e a conta de origem/destino;
  - descrição padronizada: `Aporte em Reserva "Viagem"` / `Resgate em Investimento "CDB Inter"`.
- Aplicar exatamente o mesmo comportamento na importação OFX, para os dois caminhos ficarem idênticos.
- Recalcular tudo após importar (contas, reservas, investimentos, patrimônio, orçamento).

## 2. Extrato: origem, destino e classificação

- Linhas de aplicação/resgate ganham etiqueta **Aplicação** + **Transferência patrimonial**, e mostram o caminho do dinheiro: `Itaú → Reserva Viagem` (aporte) ou `Reserva Viagem → Itaú` (resgate).
- Aporte/resgate feito manualmente na tela de Reservas ou Investimentos passa a registrar a mesma linha no extrato da conta escolhida, com o mesmo formato — hoje só o resgate faz isso.
- Adicionar em Reservas e Investimentos a ação de **Aporte** debitando de uma conta específica (o resgate já existe).

## 3. Saldo diário no extrato

- Agrupar o extrato por data, com cabeçalho de dia e, ao final de cada dia, **Saldo do dia** = saldo anterior + entradas − saídas daquele dia, por conta.
- O saldo do dia usa o saldo real da conta (a partir do saldo inicial e da data do saldo inicial), sem ser afetado por filtros de categoria/tipo — os filtros continuam escondendo linhas, mas o saldo mostrado permanece o real.
- Com "todas as contas" selecionadas, o rodapé do dia mostra o saldo consolidado e, ao expandir, o saldo por conta.

## 4. Patrimônio

- Passar o Patrimônio Total para **Contas + Reservas + Investimentos**, conforme pedido, e ajustar o modal "Como o patrimônio foi calculado" e os textos de apoio para explicar essa composição.
- Aplicações/resgates não alteram o total: apenas mudam o dinheiro de lugar dentro dele.

## Detalhes técnicos

- `src/lib/patrimony.ts`: já traz `detectApplication`, `resolveTargets` e `applyPatrimonyEffects`; será chamado no `runImport` de `PDFImport.tsx` e `OFXImport.tsx`, e reaproveitado pelas ações manuais em `financas.tsx`.
- Saldo diário calculado em memória sobre a lista completa de `finances` (não filtrada), por `account_id`, partindo de `initial_balance`/`initial_balance_date`; extraído para um helper em `src/lib/finance.ts`.
- Ajuste do patrimônio em `financas.tsx` (`const patrimony`), `Overview`, insights e `PatrimonyAudit`.
- Nenhuma alteração de schema é necessária.
