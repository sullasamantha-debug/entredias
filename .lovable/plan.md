# Linhas de saldo não devem virar despesa na importação de PDF

## O problema

O leitor de extrato PDF só descarta linhas de saldo quando a linha **começa** com
"Saldo anterior/inicial/final/do dia/em conta" (`src/lib/pdf-statement.ts`, linha 132).

Quando o banco imprime o saldo em outro formato — com data na frente
("01/09/2026 SALDO DO DIA 1.234,56"), ou com outra palavra
("Saldo disponível", "Saldo total", "Saldo bloqueado", "SALDO (R$)") — a linha passa pelo
filtro, é lida como movimentação e, por não ter indicação de crédito, cai no padrão
**Despesa** (linha 194), aparecendo na conferência pedindo categoria.

## O que será ajustado

1. **Reconhecer qualquer linha de saldo como saldo, não como lançamento**
   - Detectar "saldo" no começo da linha *ou* no começo da descrição depois da data.
   - Cobrir as variações usuais: anterior, inicial, final, do dia, em conta, disponível,
     total, bloqueado, "saldo (R$)", "saldo:".
   - Usar o valor dessas linhas apenas como saldo de referência (ajuda a decidir
     entrada/saída das linhas seguintes), sem criar transação.

2. **Descartar também linhas de totalizador** que não são movimentação
   ("total de créditos/débitos", "subtotal", "resumo do período").

3. **Rede de segurança na conferência**: linhas cuja descrição seja apenas saldo/total
   entram já marcadas como **ignoradas**, então mesmo que algum formato novo escape do
   parser nada é lançado sem você mandar.

## Detalhes técnicos

- `src/lib/pdf-statement.ts`:
  - extrair um `BALANCE_RE` mais amplo e aplicá-lo (a) na linha bruta e (b) no `rest`
    após o parse da data, antes de montar a transação; nos dois casos atualizar
    `prevBalance` com o último valor da linha e seguir para a próxima.
  - adicionar `NON_TX_RE` (total/subtotal/resumo) com o mesmo tratamento de descarte,
    sem mexer em `prevBalance`.
- `src/components/PDFImport.tsx`: ao montar as linhas da prévia, definir
  `ignore: true` quando a descrição casar com o padrão de saldo/total.
- Sem mudanças de banco de dados e sem impacto na importação OFX.
