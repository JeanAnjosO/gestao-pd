# Gestão PD

Sistema de gestão operacional para unidades de uma escola de forró. Reúne escalas, calendário, faltas, substituições, aulas solo, relatórios de pagamento e parâmetros de equipe.

## Tecnologias

- Next.js/React com vinext
- TypeScript
- Supabase Auth e Postgres
- Cloudflare Workers/Sites

## Requisitos

- Node.js `>=22.13.0`

## Desenvolvimento local

```bash
npm install
npm run dev
```

## Validação

```bash
npm test
npm run lint
```

O teste gera a aplicação de produção, valida as rotas principais e confirma os limites arquiteturais extraídos da página central.

## Estrutura principal

- `app/page.tsx`: composição da aplicação e módulos funcionais atuais
- `app/components/`: componentes visuais reutilizáveis
- `app/domain/types.ts`: contratos do domínio
- `app/domain/constants.ts`: configurações e catálogos estáveis
- `app/domain/utils.ts`: regras puras e utilitários compartilhados
- `app/supabase.ts`: cliente de acesso ao Supabase
- `supabase/migrations/`: histórico de alterações do banco
- `supabase/functions/`: funções administrativas executadas no servidor
- `tests/`: testes de regressão da aplicação compilada

## Regras de contribuição

- Preserve os IDs dos catálogos de tipos, pois eles fazem parte do contrato com o banco.
- Não coloque chaves administrativas do Supabase no cliente.
- Toda mudança funcional deve incluir validação proporcional em `tests/`.
- Execute `npm test` antes de abrir um pull request.
