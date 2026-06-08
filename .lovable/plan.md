## Contexto

O erro **"Failed to fetch"** no login é causado pelo proxy de fetch do **ambiente Preview da Lovable** (`lovable.js`), que intercepta a requisição `POST /auth/v1/token?grant_type=password` do Supabase Auth e a quebra. Não é um bug do código, do Supabase, do CORS, nem das variáveis de ambiente.

**Provas:**
- Logs de auth do Supabase mostram logins 200 OK para o usuário (`sullasamantha@gmail.com`, 2026-06-08 10:11:41).
- `.env` tem `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` corretos.
- Cliente em `src/integrations/supabase/client.ts` é o auto-gerado padrão.
- Login não usa server functions nem rotas customizadas → não há superfície para erro de CORS do nosso lado.

**Validação:** o login funciona normalmente em https://entredias.lovable.app/login (URL publicada, sem proxy).

Como não dá para "consertar" o proxy do preview pelo código, o plano foca em **melhorar a experiência de erro** para o usuário entender o que aconteceu quando rodar no preview.

## Mudanças

### 1. `src/routes/login.tsx` — tratamento de erro melhorado

No `catch` do `handle()`:

- Detectar `TypeError: Failed to fetch` / `err.message === "Failed to fetch"` / `err.name === "AuthRetryableFetchError"`.
- Quando detectado, mostrar toast com mensagem clara:
  > "Não foi possível conectar ao servidor de autenticação. Se você está no preview do Lovable, tente novamente ou acesse pelo domínio publicado."
- Para erros conhecidos do Supabase (credenciais inválidas, email não confirmado), traduzir para PT-BR.
- Demais erros: continuar mostrando `err.message`.
- Logar o erro completo no `console.error` para debug.

### 2. Sem outras mudanças

- Não mexer em `client.ts` (auto-gerado).
- Não alterar `.env`.
- Não adicionar nenhum override de `window.fetch`.
- Não tocar em CORS / configuração do Supabase.

## Resultado esperado

- Em produção (`entredias.lovable.app`): login continua funcionando normalmente (já funciona).
- No preview: se o proxy quebrar a requisição, o usuário vê uma mensagem clara explicando a causa, em vez de "Failed to fetch".
