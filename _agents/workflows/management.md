---
description: Gerenciar consultas e prontuários de pacientes
---

Este workflow descreve como o agente deve interagir com o sistema de dentista para gerenciar pacientes e consultas.

### 1. Pesquisar Paciente
Para encontrar um paciente, o agente deve:
- Usar a API de busca por nome ou CPF.
- Verificar se o paciente existe no `Prontuário`.

### 2. Agendar Consulta
// turbo
Ao agendar uma nova consulta:
- Verificar disponibilidade no calendário.
- Criar a entrada na tabela de `Atendimento`.
- Disparar uma mensagem de confirmação via **Evolution API** (WhatsApp).

### 3. Gerar Resumo Financeiro (DFC)
Para gerenciar o financeiro:
- Consultar a tabela DFC.
- Calcular lucro líquido baseado em receitas e custos operacionais.
- Apresentar um relatório formatado para o usuário.
