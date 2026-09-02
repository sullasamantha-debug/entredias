# Finanças: corrigir os dois textos sobre reservas no patrimônio

O ciclo de aportes/resgates manuais e importados já está fechado. Resta apenas alinhar duas frases que ainda repetem a regra antiga ("reservas não somam ao patrimônio"), o que contradiz o cálculo em uso (Patrimônio = Contas + Reservas + Investimentos).

## Ajustes

1. Aba Visão geral (card de reservas): trocar "As reservas separam parte do saldo das contas — não somam ao patrimônio." por um texto que explique que o aporte sai do saldo da conta e passa a ficar guardado na reserva, permanecendo dentro do patrimônio.

2. Modal "Como foi calculado seu patrimônio": trocar "Reservas não somam — elas apenas separam parte do saldo das contas." por a explicação de que o patrimônio soma contas + reservas + investimentos, e que aportes apenas movem o dinheiro da conta para a reserva sem alterar o total.

## Detalhes técnicos

- Apenas duas alterações de texto em `src/routes/_app/financas.tsx` (linhas 323 e 1923).
- Sem mudanças de lógica, consultas ou banco de dados.
