# Finanças: fechar o ciclo de aportes manuais e alinhar textos

O que já está pronto: importação (PDF e OFX) detecta aplicações/resgates, grava a transferência patrimonial no extrato, atualiza reservas/investimentos e o histórico; o extrato mostra as etiquetas Aplicação / Transferência patrimonial e o **Saldo do dia** por conta; Patrimônio Total = Contas + Reservas + Investimentos. Falta o mesmo comportamento nas ações feitas à mão e corrigir textos antigos.

## 1. Aporte manual em Reservas

Hoje o botão "+ Reservar" só aumenta o valor da reserva, sem debitar conta nenhuma e sem aparecer no extrato (o resgate já faz isso).

- No diálogo de reservar, pedir a **conta de origem** (padrão: a conta vinculada à reserva), com aviso de que o valor sai do saldo dessa conta.
- Ao confirmar: aumentar a reserva, lançar no extrato da conta escolhida uma linha de **Transferência patrimonial** com a descrição padronizada `Aporte em Reserva "Viagem"`, e gravar no histórico da reserva o valor, a data e a conta de origem.

## 2. Aporte manual em Investimentos

Hoje só existe "Resgatar".

- Adicionar a ação **Aportar** no card do investimento: valor, data e conta de origem.
- Ao confirmar: somar ao valor aplicado e ao valor atual, lançar a linha de transferência patrimonial no extrato da conta (`Aporte em Investimento "CDB Inter"`) e gravar no histórico do investimento com a conta de origem.
- Garantir que o resgate manual também registre a conta de destino no histórico, no mesmo formato.

## 3. Textos desalinhados com a regra atual

- A frase nas Reservas ("não somam ao patrimônio") contradiz a regra vigente: reservas entram no patrimônio. Reescrever para explicar que reservas separam parte do saldo da conta e continuam dentro do patrimônio.
- Revisar os textos de Visão geral, insights e do modal "Como o patrimônio foi calculado" que ainda falem "contas + investimentos".

## Detalhes técnicos

- Reutilizar `patFinanceRow`, `patLabelFor` e `applyPatrimonyEffects` de `src/lib/patrimony.ts` nas ações manuais, para que import e ação manual gerem exatamente as mesmas linhas e histórico.
- Alterações concentradas em `src/routes/_app/financas.tsx` (abas Reservas e Investimentos e textos de apoio).
- Após cada operação, invalidar as queries de contas, reservas, investimentos, lançamentos e movimentações para o saldo do dia e o patrimônio recalcularem sozinhos.
- Nenhuma mudança de banco de dados é necessária.
