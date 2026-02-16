# HubPanel

Gerenciador de Banco de Dados PostgreSQL - Interface web moderna e intuitiva para gerenciar múltiplos bancos PostgreSQL.

## Funcionalidades

- **Dashboard** - Visão geral de todos os bancos de dados
- **Browser de Tabelas** - Navegar schemas, tabelas e dados
- **Editor SQL** - Monaco Editor com syntax highlighting e auto-complete
- **CRUD Visual** - Editar dados diretamente na tabela (click-to-edit)
- **Backup & Restore** - Backup com download e restore de arquivos SQL
- **Gestão de Usuários** - Criar, editar e remover usuários PostgreSQL
- **Monitoramento** - Conexões ativas, queries lentas, performance
- **Logs de Atividade** - Auditoria completa de todas as operações
- **Magic Link Auth** - Autenticação segura via email (sem senhas)

## Tech Stack

- **Next.js 15** (App Router) + TypeScript
- **Tailwind CSS** + shadcn/ui
- **NextAuth.js** + Resend (Magic Link)
- **node-postgres** (pg)
- **Monaco Editor**
- **Docker**

## Quick Start

```bash
# Clonar o repositório
git clone https://github.com/LisboaCodes/HubPanel.git
cd HubPanel

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# Rodar em desenvolvimento
npm run dev
```

## Deploy com Docker

```bash
# Build e run
docker compose up -d

# Ou via Coolify
# Adicionar como Source no Coolify apontando para o repositório
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `NEXTAUTH_URL` | URL da aplicação |
| `NEXTAUTH_SECRET` | Secret para JWT |
| `RESEND_API_KEY` | API key do Resend para magic links |
| `EMAIL_FROM` | Email remetente |
| `AUTHORIZED_EMAILS` | Emails autorizados (comma-separated) |
| `DB_1_NAME` ... `DB_5_NAME` | Nome do banco |
| `DB_1_HOST` ... `DB_5_HOST` | Host do banco |
| `DB_1_PORT` ... `DB_5_PORT` | Porta do banco |
| `DB_1_USER` ... `DB_5_USER` | Usuário do banco |
| `DB_1_PASSWORD` ... `DB_5_PASSWORD` | Senha do banco |
| `DB_COUNT` | Número total de bancos configurados |

## Licença

MIT
