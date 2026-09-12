# Diagrama de Casos de Uso — Taxify

Cobre todas as telas e funcionalidades disponíveis no front-end: autenticação
(login/cadastro), CRUD de empresas e gestão do vínculo usuário↔empresa.

```mermaid
flowchart LR
    Visitante([Visitante]):::actor
    Usuario([Usuário Autenticado]):::actor

    subgraph Taxify["Sistema Taxify"]
        direction TB

        subgraph Auth["Autenticação"]
            direction TB
            UC1(("Fazer login"))
            UC2(("Cadastrar-se"))
            UC3(("Sair (logout)"))
        end

        subgraph Empresas["Empresas"]
            direction TB
            UC4(("Listar empresas"))
            UC5(("Buscar empresa\npor nome"))
            UC6(("Cadastrar empresa"))
            UC7(("Editar empresa"))
            UC8(("Excluir empresa"))
        end

        subgraph Vinculos["Vínculos usuário-empresa"]
            direction TB
            UC9(("Consultar vínculos\nde um usuário"))
            UC10(("Visualizar vínculos\ndo próprio usuário"))
            UC11(("Vincular empresa\na usuário"))
            UC12(("Remover vínculo\nusuário-empresa"))
        end
    end

    Visitante --> UC1
    Visitante --> UC2

    Usuario --> UC3
    Usuario --> UC4
    Usuario --> UC6
    Usuario --> UC7
    Usuario --> UC8
    Usuario --> UC9
    Usuario --> UC11
    Usuario --> UC12

    UC5 -.->|"«extend»"| UC4
    UC10 -.->|"«extend»"| UC9

    classDef actor fill:#2050a2,color:#fff,stroke:#163c7e,stroke-width:2px;
```

## Descrição dos casos de uso

### Autenticação
| Caso de uso | Ator | Descrição |
|---|---|---|
| Fazer login | Visitante | Autentica com login e senha (tela dividida com painel ilustrado, carrossel para o cadastro). |
| Cadastrar-se | Visitante | Wizard de 3 etapas (Dados pessoais, Contato, Senha) para criar um novo usuário. |
| Sair (logout) | Usuário Autenticado | Encerra a sessão e retorna à tela de login. |

### Empresas
| Caso de uso | Ator | Descrição |
|---|---|---|
| Listar empresas | Usuário Autenticado | Lista paginada de empresas cadastradas. |
| Buscar empresa por nome | Usuário Autenticado | *«extend»* de "Listar empresas" — filtra a listagem pelo nome digitado. |
| Cadastrar empresa | Usuário Autenticado | Abre modal para criar uma nova empresa (nome, tipo e número de documento). |
| Editar empresa | Usuário Autenticado | Abre modal pré-preenchido para atualizar os dados de uma empresa existente. |
| Excluir empresa | Usuário Autenticado | Remove uma empresa da listagem (com confirmação). |

### Vínculos usuário-empresa
| Caso de uso | Ator | Descrição |
|---|---|---|
| Consultar vínculos de um usuário | Usuário Autenticado | Busca os vínculos de qualquer usuário informando o ID. |
| Visualizar vínculos do próprio usuário | Usuário Autenticado | *«extend»* de "Consultar vínculos" — atalho "Meu usuário" que preenche o próprio ID. |
| Vincular empresa a usuário | Usuário Autenticado | Associa uma empresa (via busca/autocomplete) a um usuário, definindo um papel/função. |
| Remover vínculo usuário-empresa | Usuário Autenticado | Desfaz a associação entre um usuário e uma empresa (com confirmação). |
