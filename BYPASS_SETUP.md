# Claude Code — Bypass de Permissões no Dev Container

## O problema

Dentro de um Dev Container no VS Code, o Claude Code ainda pede confirmação para cada comando bash, mesmo que você queira autonomia total. Isso acontece porque há **dois lugares** onde as permissões precisam ser configuradas:

1. Arquivos `.claude/settings.json` / `.claude/settings.local.json` do projeto
2. Configuração do VS Code dentro do container

Ambos precisam estar configurados. Se só um estiver, o prompt ainda aparece.

---

## Configuração completa

### 1. Arquivos `.claude/` do projeto

**`.claude/settings.json`** (versionado no repositório):
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "skipDangerousModePermissionPrompt": true
}
```

**`.claude/settings.local.json`** (ignorado pelo git — configurações pessoais):
```json
{
  "permissions": {
    "defaultMode": "bypassPermissions"
  },
  "skipDangerousModePermissionPrompt": true
}
```

### 2. Settings do VS Code no container

O arquivo fica em `/home/<user>/.vscode-server/data/Machine/settings.json` dentro do container.

Adiciona a linha:
```json
{
  "claudeCode.permissionMode": "bypassPermissions"
}
```

> **Atenção:** Esse arquivo é do VS Code Server rodando dentro do container, não do VS Code no seu host. Qualquer mudança aqui só afeta o container atual.

---

## Após configurar

Faz um **Reload Window** para aplicar:

```
Ctrl+Shift+P → "Developer: Reload Window"
```

---

## Lembrete importante — recriação do container

Se o container for **destruído e recriado** (`Rebuild Container`), o arquivo `/home/<user>/.vscode-server/data/Machine/settings.json` pode ser resetado, dependendo de como o `devcontainer.json` está configurado.

**Para tornar permanente**, adiciona no `devcontainer.json`:

```json
{
  "customizations": {
    "vscode": {
      "settings": {
        "claudeCode.permissionMode": "bypassPermissions"
      }
    }
  }
}
```

Assim, toda vez que o container for recriado, o VS Code já aplica essa configuração automaticamente.

---

## Resumo dos arquivos a configurar

| Arquivo | O que faz | Persiste no rebuild? |
|---|---|---|
| `.claude/settings.json` | Bypass no Claude CLI | Sim (versionado) |
| `.claude/settings.local.json` | Bypass pessoal | Sim (se no volume) |
| `~/.vscode-server/data/Machine/settings.json` | Bypass na extensão VS Code | **Não** (reseta no rebuild) |
| `devcontainer.json` → `customizations.vscode.settings` | Bypass permanente na extensão | **Sim** |
