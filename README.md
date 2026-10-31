# 🧾 Taxify — Web (taxify-ui)

> Plataforma para **escritórios de contabilidade** que automatiza a captura de **XMLs de notas fiscais**, encontra **erros de classificação fiscal (CFOP/NCM)** e gera a **retificação** com trilha de auditoria.

Este repositório contém o **front-end web** do Taxify. A API está em **[taxify-service](https://github.com/thiagoocms/taxify-service)**.

| Repositório | Papel |
|---|---|
| [taxify-service](https://github.com/thiagoocms/taxify-service) | API REST, integrações, rotinas agendadas e regras fiscais |
| **[taxify-ui](https://github.com/thiagoocms/taxify-ui)** (este) | Front-end web em Angular |

---

## 🎯 Visão de negócio

**Problema:** escritórios de contabilidade perdem horas baixando notas fiscais de cada cliente e só descobrem notas emitidas com **CFOP ou NCM errados** quando o problema já virou retrabalho ou multa.

**Solução:** um painel único onde a equipe do escritório:

- **Gerencia as empresas clientes**, com documentos, planos contratados e regras fiscais de cada uma.
- **Consulta as notas fiscais** capturadas automaticamente, com detalhes de emitente, destinatário, produtos, impostos e totais.
- **Cadastra as regras fiscais por produto** (CFOP/NCM corretos) para o sistema apontar as divergências.
- **Controla a equipe:** usuários, perfis e quais empresas cada um atende.
- **Administra planos e assinaturas**, o modelo SaaS do produto.

---

## 🛠️ Visão técnica

### Stack
- **Angular 19** (standalone components) + **TypeScript 5.7**
- **Bootstrap 5**
- **ngx-toastr** para notificações
- **Nginx** como servidor da build e **proxy reverso** para a API, o Grafana e o Prometheus (com autenticação básica)
- **Docker**

### Telas
| Rota | Funcionalidade |
|---|---|
| `/auth/login` | Login com painel ilustrado |
| `/auth/register` | Cadastro em etapas (wizard com indicador de progresso) |
| `/home` | Página inicial |
| `/cadastro/empresas` | Empresas: lista, cadastro/edição, **regras fiscais por produto** e **assinaturas** |
| `/notas-fiscais` | Lista de XMLs fiscais com filtros e paginação |
| `/notas-fiscais/:id` | Detalhe da nota: emitente, destinatário, itens, impostos e totais |
| `/cadastro/usuarios` | Usuários e vínculos usuário ↔ empresa |
| `/cadastro/planos` | Planos e serviços liberados |

### Arquitetura
```
src/app/
├── core/
│   ├── guards/        # proteção de rotas autenticadas
│   ├── interceptors/  # token JWT, loading e tratamento de erros
│   ├── models/        # tipagens espelhando os DTOs da API
│   └── services/      # comunicação com a API
├── features/          # módulos por domínio (auth, companies, invoices, users, plans, accounting-firm)
└── shared/
    ├── components/    # biblioteca própria: button, input, table, modal, pagination, toggle, step-indicator
    ├── layout/        # header e sidebar
    └── styles/ utils/
```

Destaques:
- **Organização por features**, com cada domínio isolado no seu diretório.
- **Componentes reutilizáveis próprios**, entre eles uma **paginação** padronizada em todas as listagens.
- **Interceptors** centralizando autenticação, loading e erros.
- **Proxy no Nginx**: front e API no mesmo domínio, sem problemas de CORS em produção.
- Casos de uso documentados em [`docs/casos-de-uso.md`](docs/casos-de-uso.md).

---

## ▶️ Como rodar

**Pré-requisitos:** Node 20+ e a [API](https://github.com/thiagoocms/taxify-service) rodando.

```bash
npm install --legacy-peer-deps
npm start          # http://localhost:4200 (usa proxy.conf.json para a API)
```

**Produção:** o `docker-compose.yml` do [taxify-service](https://github.com/thiagoocms/taxify-service) sobe o front junto com a API, o MySQL e a observabilidade.

---

Desenvolvido por **[Thiago](https://github.com/thiagoocms)**
