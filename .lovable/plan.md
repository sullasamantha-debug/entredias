# Plano — Finanças pessoais completas

Reformular `/financas` em um hub financeiro pessoal com múltiplas seções, mantendo o visual cozy/clean já usado nos demais módulos.

## Backend (uma migration)

Novas tabelas (todas com RLS `auth.uid() = user_id` + GRANTs):

- `finance_settings` — `user_id` (unique), `initial_balance` numeric
- `savings_jars` — nome, valor_atual, meta, cor, icone, observacoes
- `savings_movements` — jar_id, kind (`deposit`/`withdraw`/`transfer_in`/`transfer_out`), amount, date, notes
- `investments` — nome, categoria (tesouro/cdb/poupanca/outros), invested, current, notes
- `credit_cards` — nome, limite, dia_fechamento, dia_vencimento, cor
- `budgets` — month (`YYYY-MM`), category (null = total), amount

Alterar `finances`:
- adicionar `card_id uuid null` (referência lógica a `credit_cards.id`)
- adicionar `paid boolean default true` (faturas pagas viram saída real)
- adicionar `invoice_month text null` (`YYYY-MM` calculado para gastos no crédito)

## Frontend

Reescrever `src/routes/_app/financas.tsx` como página com **tabs**:

1. **Visão geral** — Patrimônio total (saldo + cofrinhos + investimentos), entradas/saídas do mês, gastos futuros no crédito, evolução, insights automáticos, gastos por categoria.
2. **Transações** — lista atual, com filtro entrada/saída/crédito, edição/exclusão. Novo registro permite marcar como crédito (escolhe cartão → calcula `invoice_month` pela regra de fechamento).
3. **Cartões** — cards de crédito com limite usado, fatura atual, próxima fatura, dias até vencer, botão "Pagar fatura" (marca itens `paid=true` e cria saída no mês de pagamento), gastos por categoria do cartão.
4. **Cofrinhos** — grid de cards com progresso até a meta, ações depositar/retirar/transferir.
5. **Investimentos** — lista com valor investido vs atual, rentabilidade %, agrupado por categoria.
6. **Orçamento** — definir orçamento total e por categoria do mês, com barras de progresso (verde/amarelo/vermelho) e alertas visuais.
7. **Configurações** — saldo inicial editável.

## Regras de cálculo

- **Saldo atual** = saldo inicial + entradas (date ≤ hoje) − saídas pagas (`paid=true` e date ≤ hoje, ou débito/pix sem cartão).
- **Gastos futuros no crédito** = soma de `finances` com `card_id` not null e `paid=false`.
- **Patrimônio total** = saldo atual + Σ cofrinhos + Σ investimentos (valor atual).
- **Fatura do cartão**: compra com `date <= dia_fechamento` do mês → fatura do mês atual; senão → próximo mês. Calculado no client ao salvar.
- **Insights**: gerados client-side comparando orçamento vs gasto, patrimônio mês atual vs anterior, próximo vencimento.

## Visual

Manter `PageHeader`, `StatCard`, `cozy-card`, `TagBadges`. Usar Tabs do shadcn. Barras de progresso para cofrinhos/orçamento. Sem dependências novas.

## Arquivos

- `supabase/migrations/<timestamp>.sql` — novas tabelas, GRANTs, RLS, alterações em `finances`.
- `src/routes/_app/financas.tsx` — reescrita completa em tabs.
- (talvez) `src/lib/finance.ts` — helpers de cálculo de fatura e saldo.

Sem alterações em outros módulos.
