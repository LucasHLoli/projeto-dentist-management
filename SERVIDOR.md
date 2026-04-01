# Guia de Servidor e Google OAuth — DentFlow

## Reiniciar o servidor

**Sempre que mudar qualquer arquivo de código, o servidor precisa ser reiniciado do zero.**
O hot reload NÃO funciona neste ambiente de container.

### Passo a passo

**1. Matar todos os processos Node/Next antigos:**
```bash
kill -9 $(ps aux | grep "next-server\|next dev" | grep -v grep | awk '{print $2}') 2>/dev/null
```

**2. Subir o servidor na porta 3334:**
```bash
cd "/workspaces/Projeto Dentist Management"
PORT=3334 npx next dev -p 3334 > /tmp/nextjs-3334.log 2>&1 &
```

**3. Aguardar o servidor ficar pronto (≈15-20s) e verificar:**
```bash
tail -5 /tmp/nextjs-3334.log
# Deve aparecer: ✓ Ready in X.Xs
```

**4. Testar se está no ar:**
```bash
curl -s http://localhost:3334/api/status
```

> Acesse em: **http://localhost:3334**

---

## Por que a porta 3334?

O container tem variáveis de sistema configuradas para a porta 5000 (do setup original).
Usar uma porta diferente força o Next.js a ignorar essas configurações antigas.
Se futuramente precisar trocar de porta, veja a seção "Problemas conhecidos".

---

## Configurar Google OAuth (do zero)

### Pré-requisitos
- Acesso ao [Google Cloud Console](https://console.cloud.google.com)
- Projeto criado com OAuth 2.0 configurado

### Passo a passo completo

**1. No Google Cloud Console:**
- Vá em **APIs & Services → Credentials**
- Clique no seu OAuth 2.0 Client ID
- Em **Authorized redirect URIs**, adicione:
  ```
  http://localhost:3334/api/auth/callback
  ```
- Em **Authorized JavaScript origins**, adicione:
  ```
  http://localhost:3334
  ```
- Salve

**2. Atualizar o `.env.local` com as credenciais:**
```env
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-sua-chave-secreta
GOOGLE_REDIRECT_URI=http://localhost:3334/api/auth/callback
```

**3. Verificar o `src/lib/google-config.ts`:**

> ⚠️ As variáveis de sistema do container sobrepõem o `.env.local`.
> Por isso, `clientSecret` e `redirectUri` estão hardcoded no arquivo.
> Se trocar de porta ou chave, edite diretamente esse arquivo:

```ts
// src/lib/google-config.ts
export const GOOGLE_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: 'GOCSPX-sua-nova-chave',   // ← editar aqui
  redirectUri: 'http://localhost:3334/api/auth/callback',  // ← editar aqui
  ...
};
```

**4. Garantir que `google-token.json` é um ARQUIVO (não diretório):**
```bash
ls -la "/workspaces/Projeto Dentist Management/google-token.json"
```
Se aparecer `drwx...` (diretório), remova:
```bash
rmdir "/workspaces/Projeto Dentist Management/google-token.json"
```
Se aparecer `frwx...` (arquivo com token antigo) e quiser reconectar:
```bash
rm "/workspaces/Projeto Dentist Management/google-token.json"
```

**5. Reiniciar o servidor** (conforme seção acima)

**6. Conectar:** acesse **http://localhost:3334/sistema** e clique em "Conectar Google Sheets"

---

## Problemas conhecidos e soluções

### Erro: `redirect_uri_mismatch`
O URI no Google Cloud Console não bate com o que o app está enviando.

**Diagnóstico:**
```bash
curl -s http://localhost:3334/api/auth | python3 -m json.tool
# Olhe o campo "authUrl" → procure "redirect_uri=..."
```

**Solução:**
1. Copie o valor exato do `redirect_uri` que apareceu
2. Adicione esse URI no Google Cloud Console → Credentials → seu OAuth Client
3. Verifique também o `google-config.ts` (hardcode acima)

---

### Erro: `invalid_client` (401)
Client ID ou Secret incorretos.

**Solução:**
1. Verifique no Google Cloud Console qual é a chave secreta atual
2. Atualize em `src/lib/google-config.ts` → `clientSecret`
3. Reinicie o servidor

---

### Erro: `EISDIR: illegal operation on a directory`
O `google-token.json` virou um diretório (acontece quando o Docker cria o mount antes do arquivo existir).

**Solução:**
```bash
rmdir "/workspaces/Projeto Dentist Management/google-token.json"
```
Depois tente autenticar novamente.

---

### Servidor não reflete mudanças no código
O hot reload não funciona no container. Sempre reinicie completamente (veja seção "Reiniciar o servidor").

**Para confirmar qual processo está na porta:**
```bash
ps aux | grep "next-server\|next dev" | grep -v grep
```
Se aparecer um PID antigo, mate-o antes de subir o novo.

---

### Mudei a porta — o que preciso atualizar?

| O que atualizar | Onde |
|---|---|
| `redirectUri` | `src/lib/google-config.ts` (hardcoded) |
| `GOOGLE_REDIRECT_URI` | `.env.local` |
| URI no Google Cloud Console | APIs & Services → Credentials → Authorized redirect URIs |
| Comando de start | Mudar `-p XXXX` e `PORT=XXXX` |

---

## Resumo rápido (dia a dia)

```bash
# Matar servidor antigo
kill -9 $(ps aux | grep "next-server\|next dev" | grep -v grep | awk '{print $2}') 2>/dev/null

# Subir servidor novo
cd "/workspaces/Projeto Dentist Management"
PORT=3334 npx next dev -p 3334 > /tmp/nextjs-3334.log 2>&1 &

# Verificar se subiu
sleep 20 && tail -3 /tmp/nextjs-3334.log
```
