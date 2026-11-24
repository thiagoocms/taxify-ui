/**
 * Conteúdo da Central de Ajuda: um artigo por tela, o glossário e as perguntas frequentes.
 * Fica junto do código de propósito — quando uma tela muda, o artigo dela muda no mesmo commit.
 */

export interface HelpSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface HelpArticle {
  id: string;
  title: string;
  group: 'Notas e documentos' | 'Obrigações e controles' | 'Configuração';
  /** Rota da tela que o artigo explica (o "?" do cabeçalho abre este artigo). */
  route?: string;
  summary: string;
  sections: HelpSection[];
  /** Outros artigos relacionados (ids). */
  related?: string[];
}

export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface FaqEntry {
  question: string;
  answer: string;
  articleId?: string;
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    id: 'notas-fiscais',
    title: 'Notas fiscais (NF-e)',
    group: 'Notas e documentos',
    route: '/notas-fiscais',
    summary: 'Consulte, confira e exporte as NF-e de mercadoria das empresas, de entrada e de saída.',
    sections: [
      {
        title: 'De onde vêm as notas',
        items: [
          'SIEG: entradas e saídas, sincronizadas automaticamente quando o plano tem "Importação de XML fiscal" + "Integração SIEG".',
          'SEFAZ (Distribuição DF-e): entradas e notas em que a empresa é transportadora, com o certificado A1 da empresa, de hora em hora, quando o plano tem "Integração SEFAZ". A SEFAZ não entrega as notas emitidas pela própria empresa.',
          'Upload manual ("Importar XML"): um XML ou um .zip. NFS-e enviadas por aqui vão para Notas de serviço.',
          'A mesma nota vinda de mais de uma fonte é guardada uma vez só. O filtro "Origem" mostra de onde ela veio primeiro.',
        ],
      },
      {
        title: 'Como usar',
        items: [
          'Escolha a empresa e o período. Os cartões de entradas e saídas mostram os totais e filtram a lista ao clicar.',
          'Clique numa nota para ver o resumo, os produtos, os totais, as divergências, a auditoria, os eventos (cancelamento, CC-e, manifestações) e o XML/DANFE.',
          'Conferência: marque a nota como conferida ou com divergência. "Marcar N da página como conferidas" confere em lote.',
          '"Só no SIEG" / "Só na SEFAZ" (filtro de origem) mostram notas que estão numa fonte e não na outra há mais de 48h.',
        ],
      },
      {
        title: 'Cuidados',
        items: [
          'Notas canceladas aparecem na lista, mas ficam fora dos totais.',
          'Uma nota de entrada que a SEFAZ entregou só como resumo ainda não aparece aqui — ela está na tela de Manifestação até o XML completo chegar.',
        ],
      },
    ],
    related: ['manifestacao', 'regras-fiscais', 'notas-servico'],
  },
  {
    id: 'notas-servico',
    title: 'Notas de serviço (NFS-e)',
    group: 'Notas e documentos',
    route: '/notas-servico',
    summary: 'NFS-e prestadas e tomadas pela empresa, com ISS e retenções federais.',
    sections: [
      {
        title: 'De onde vêm',
        items: [
          'SIEG: uma vez por dia por empresa, os últimos 35 dias (na primeira vez, os últimos 3 meses).',
          'Ambiente Nacional (Sistema Nacional NFS-e): de hora em hora, com o certificado A1 da empresa, quando o plano tem "Integração NFS-e Nacional". Traz as prestadas e as tomadas dos municípios no padrão nacional; cancelamentos marcam a nota como cancelada.',
          'A mesma NFS-e vinda das duas fontes é guardada uma vez só; os atalhos "só no SIEG" / "só no Ambiente Nacional" mostram as que estão numa fonte e não na outra há mais de 48h.',
          '"Buscar este mês no SIEG" traz um mês anterior em segundo plano — o SIEG libera 2 consultas por minuto, então pode levar alguns minutos.',
          'Upload manual pela tela de Notas fiscais (o sistema reconhece a NFS-e e guarda aqui).',
          'Os dois layouts são lidos: o nacional (padrão do Ambiente Nacional) e o ABRASF, usado por muitos municípios.',
        ],
      },
      {
        title: 'Prestada × tomada',
        paragraphs: [
          'Prestada = a empresa é a prestadora do serviço (é ela quem sofre a retenção). Tomada = a empresa contratou o serviço (é ela quem retém e recolhe). O sistema decide pelo CNPJ da empresa na nota.',
        ],
      },
      {
        title: 'Os números do mês',
        items: [
          '"Retido pelos tomadores" (nas prestadas) é o que a empresa pode compensar.',
          '"Retido pela empresa" (nas tomadas) é o que ela precisa recolher.',
          'PIS e COFINS só contam como retidos quando a nota diz que foram retidos; senão são apenas informados.',
        ],
      },
    ],
    related: ['retencoes'],
  },
  {
    id: 'manifestacao',
    title: 'Manifestação do destinatário',
    group: 'Notas e documentos',
    route: '/manifestacao',
    summary: 'As notas de entrada que ainda precisam de Confirmação, Desconhecimento ou Operação não Realizada, com o prazo de cada uma.',
    sections: [
      {
        title: 'O que é',
        paragraphs: [
          'Quem recebe uma NF-e se manifesta na SEFAZ sobre ela. A Ciência da Operação diz "sei que esta nota existe" e libera o XML completo; a manifestação conclusiva diz o que aconteceu: Confirmação (recebi), Desconhecimento (não reconheço esta nota) ou Operação não Realizada (a operação foi acordada mas não aconteceu).',
          'O prazo é de 180 dias a partir da autorização da nota. A lista mostra as notas dos últimos 180 dias sem manifestação conclusiva, com o prazo mais próximo primeiro.',
        ],
      },
      {
        title: 'Como enviar',
        items: [
          'Escolha a empresa, marque as notas e use os botões do topo: Confirmar operação, Só ciência, Não realizada ou Desconhecer.',
          '"Não realizada" pede uma justificativa de 15 a 255 caracteres (exigência da SEFAZ).',
          'O envio é assinado com o certificado A1 da empresa, até 100 notas por vez. O retorno da SEFAZ vem por nota: as registradas saem da lista; as recusadas mostram o motivo na linha.',
          'Uma nota que só tinha o resumo é liberada pela manifestação e o XML completo chega na captura seguinte.',
        ],
      },
      {
        title: 'Cuidados',
        items: [
          'O evento fica registrado na SEFAZ e o emitente vê.',
          'Desconhecimento é para nota que a empresa não reconhece (possível uso indevido do CNPJ). Para devolução ou recusa no recebimento use "Não realizada".',
          'A Ciência sozinha não conclui a manifestação.',
          'Para enviar, o plano precisa de "Manifestação do destinatário" (junto com "Integração SEFAZ") e a empresa precisa de certificado A1 válido.',
        ],
      },
    ],
    related: ['notas-fiscais', 'empresas'],
  },
  {
    id: 'retencoes',
    title: 'Retenções',
    group: 'Obrigações e controles',
    route: '/retencoes',
    summary: 'O que cada cliente tem a recolher e a compensar na competência, com a ação e o vencimento de cada tributo.',
    sections: [
      {
        title: 'De onde vêm',
        items: [
          'NFS-e (Notas de serviço): ISS retido, IRRF, CSLL, INSS e — quando retidos — PIS e COFINS.',
          'NF-e com o grupo de retenções (retTrib), que aparece quando a nota também cobra serviço.',
          'ICMS-ST das compras, como informativo (vai para a conferência da fronteira).',
          'Tudo é calculado das notas da competência; canceladas ficam fora.',
        ],
      },
      {
        title: 'Naturezas',
        items: [
          'A recolher: a empresa tomou o serviço e reteve. ISS na guia do município de incidência; IRRF em DARF 1708; PIS/COFINS/CSLL em DARF 5952; INSS na EFD-Reinf (R-2010) e DCTFWeb. Vencimento federal no dia 20 do mês seguinte (antecipado no fim de semana).',
          'A compensar: a empresa prestou o serviço e sofreu a retenção. A ação segue o regime da empresa na competência (Simples: ISS no PGDAS-D, INSS na DCTFWeb; Presumido/Real: IRRF e CSLL no IRPJ/CSLL, PIS/COFINS no mês).',
          'Informativo: ICMS-ST das compras.',
          'Provável indevida: IRRF, PIS, COFINS ou CSLL retidos de prestador do Simples Nacional — confira e peça o ajuste ao tomador. Também vira pendência.',
        ],
      },
      {
        title: 'Como usar',
        items: [
          'Sem empresa escolhida a tela mostra toda a carteira. As setas trocam a competência (padrão: mês anterior).',
          'Marque as linhas e use "Marcar como conferidas" — fica registrado quem conferiu e quando.',
          '"Exportar CSV" gera a planilha da tela (abre no Excel em português).',
        ],
      },
      {
        title: 'Limites',
        items: [
          'Feriados não são considerados no vencimento; o ISS vence conforme o município.',
          'Confira antes de emitir as guias: o cálculo depende do que está nas notas.',
        ],
      },
    ],
    related: ['notas-servico', 'pendencias'],
  },
  {
    id: 'pendencias',
    title: 'Pendências',
    group: 'Obrigações e controles',
    route: '/pendencias',
    summary: 'O que falta em cada empresa da carteira, por prioridade, num lugar só.',
    sections: [
      {
        title: 'Como funcionam',
        items: [
          'São recalculadas de hora em hora (ou em "Atualizar agora"). Cada causa vira uma pendência por empresa, sem repetir.',
          'Quando a causa some (ex.: o certificado foi renovado), a pendência fecha sozinha; se a causa voltar, ela reabre.',
          'Resolver ou desconsiderar pede um comentário e registra quem e quando. Uma pendência fechada à mão continua fechada enquanto a causa existir.',
        ],
      },
      {
        title: 'O que vira pendência',
        items: [
          'Certificado A1 vencido (alta) ou vencendo em 30 dias (média).',
          'Captura pela SEFAZ falhando (alta) e captura de NFS-e pelo Ambiente Nacional falhando (alta).',
          'Prazo de manifestação em até 15 dias (alta) e ciência recusada pela SEFAZ (média).',
          'Nota conferida com divergência (média) e regime tributário não informado (média).',
          'Provável retenção indevida (média) e ISS retido sem valor (baixa).',
          'Nota só no SIEG ou só na SEFAZ há mais de 48h (baixa).',
          'Achados da Auditoria tipo malha (a severidade vem da regra).',
        ],
      },
      {
        title: 'Saúde das integrações',
        paragraphs: [
          'Embaixo, as coletas de cada empresa (SEFAZ e NFS-e Nacional): a última execução, a situação e quantas execuções houve (e quantas falharam) nos últimos 7 dias.',
        ],
      },
    ],
    related: ['retencoes', 'manifestacao', 'empresas'],
  },
  {
    id: 'fronteira',
    title: 'Fronteira PE (e-Fisco)',
    group: 'Obrigações e controles',
    route: '/fronteira',
    summary: 'O ICMS antecipado que o e-Fisco (SEFAZ-PE) cobra nas compras interestaduais, recalculado nota a nota pelo Taxify.',
    sections: [
      {
        title: 'Como importar',
        items: [
          'No e-Fisco, emita o "Extrato de notas fiscais relativas a operações interestaduais sujeitas ao ICMS antecipado" do período e salve o PDF.',
          'Na tela, escolha a empresa (de Pernambuco) e use "Importar extrato do e-Fisco". O período vem do próprio extrato; importar o mesmo período de novo substitui o anterior.',
          'O extrato precisa ser da inscrição estadual da empresa (quando ela tem IE no cadastro).',
          'Sem extrato, a tela mostra a prévia: o ICMS que o Taxify calcula para as entradas interestaduais do mês.',
        ],
      },
      {
        title: 'Como o Taxify calcula',
        items: [
          'Cada item da nota é calculado pela Tabela de ICMS: alíquota interestadual pela origem e pela UF (4%, 7% ou 12%), alíquota interna de PE (modal e exceções por NCM), ST com a MVA ajustada e a carga líquida do credenciamento (o "tipo de cálculo" do e-Fisco, que vale para a empresa credenciada de qualquer regime) ou do Simples (art. 363-A).',
          'Sem encerramento (regime normal) e uso e consumo: como na memória de cálculo do e-Fisco — partida × interna − crédito (a interestadual sobre o produto, sem o frete; do fornecedor do Simples, o crédito outorgado).',
          'Mercadoria com agregação (regra por NCM, como o "Cálculo Mercadoria" do e-Fisco): partida × (1 + agregação) × interna − crédito. Vale no lugar da carga líquida do credenciamento para o que ela cobrir.',
          'Ativo e uso e consumo: pelo CFOP da regra fiscal do produto (1551, 1556...), só o diferencial — sem agregação nem carga líquida. É onde costuma aparecer "cobrou a mais".',
          'Base dupla (arts. 333/336): no regime normal e no ativo/uso e consumo a memória mostra, só como informação, quanto seria pela base dupla — (partida − ICMS destacado) ÷ (1 − interna) × interna − crédito — e a exposição em relação ao e-Fisco. O resultado continua pelo cálculo do e-Fisco; para usar a base dupla, cadastre-a como fórmula própria.',
          'Devolução, remessa e outras saídas ficam sem antecipação; item com ST já retido pelo fornecedor também.',
          'A SEFAZ-PE arredonda de um jeito próprio: o Taxify calcula de 4 formas e a nota confere quando o valor cobrado cai na faixa (tolerância de R$ 0,03).',
          '"Ver cálculo" mostra a memória de cada item: as regras usadas, os valores e a fórmula.',
        ],
      },
      {
        title: 'Fórmula própria',
        items: [
          'Quando quiser calcular diferente, use "Usar fórmula própria" na memória do item (ou "Nova regra" na Tabela de ICMS e fórmulas).',
          'A fórmula usa variáveis da nota, como partida, icms_origem, interna, inter, mva_ajustada e percentual, e aceita 5,5%, parênteses, min, max e arred.',
          'Ela vale para o que você indicar (produto, fornecedor, NCM ou a empresa toda) e fica registrada para as próximas notas. A mais específica vence.',
          '"Substitui qual cálculo" diz qual cálculo padrão ela troca (sem encerramento, ST, carga líquida, uso e consumo). Para deixar uma conta como padrão, crie a fórmula para todas as empresas, sem filtros, e escolha o cálculo. Devolução, remessa e ST já retido nunca são substituídos.',
          'Variáveis do crédito: icms_origem (destacado), credito_sn (o que o fornecedor do Simples transfere) e credito (o destacado ou, sem ele, o do Simples).',
          'Regra nova ou alterada fica "a conferir" até o time fiscal conferir; o resultado que a usa mostra "a conferir".',
        ],
      },
      {
        title: 'Resultados',
        items: [
          'Confere, Cobrou a mais (candidata a pedido de revisão), Cobrou a menos e SEFAZ não calculou (risco, não economia).',
          'Sem regra: algum item não tem alíquota ou regra na tabela — nunca vira "cobrou a mais". Pendente: sem o XML completo (ou só com o resumo da SEFAZ).',
          'Documento de trabalho: não substitui o extrato nem o DAE oficiais. Pauta/PMPF, frete FOB (CT-e) e alíquotas especiais: conferir à parte.',
        ],
      },
    ],
    related: ['auditoria', 'notas-fiscais', 'retencoes'],
  },
  {
    id: 'auditoria',
    title: 'Auditoria tipo malha',
    group: 'Obrigações e controles',
    route: '/auditoria',
    summary: 'Os cruzamentos que a fiscalização costuma fazer, encontrados antes dela: um laudo por empresa e mês.',
    sections: [
      {
        title: 'O que é verificado',
        items: [
          'Integridade das notas emitidas pela empresa: lacuna na numeração por série, o mesmo número com duas chaves, devolução sem a nota original e entradas que ficaram só com o resumo da SEFAZ.',
          'Coerência dos itens das notas emitidas: CFOP × destino, alíquota interestadual (4% no importado), regime do emitente × CST/CSOSN, CFOP de ST × CST, CEST nos itens com ST e o grupo IBS/CBS das NF-e de 2026.',
          'Anomalias: faturamento do mês acima de 3 vezes a média dos meses anteriores, cancelamento de NFC-e acima de 5% e receita perto do sublimite / limite do Simples Nacional ou do MEI.',
        ],
      },
      {
        title: 'Como funciona',
        items: [
          'Roda sozinha todo dia (05:30) para a competência anterior e a atual das empresas com "Auditoria de notas fiscais" no plano; "Rodar auditoria" roda na hora para qualquer mês.',
          'Cada achado vira uma pendência (aparece também em Pendências): fecha sozinho quando o indício some; resolver ou desconsiderar pede comentário.',
          '"Laudo PDF" e "Exportar CSV" geram o laudo do mês com os achados e os fundamentos.',
        ],
      },
      {
        title: 'Regras e conferência',
        items: [
          'A visão "Regras" mostra cada regra com o fundamento legal, o link oficial e a vigência.',
          'Uma regra que o time fiscal ainda não conferiu gera achados "a conferir"; depois de "Marcar como conferida", os achados passam a ser indícios. Desativar uma regra tira os achados dela das próximas auditorias.',
          'Os achados são indícios para conferência, nunca infração afirmada.',
        ],
      },
      {
        title: 'Ainda não cobre',
        items: ['A malha do Simples (receita das notas × receita declarada no PGDAS-D) depende da importação do PGDAS, que ainda não existe.'],
      },
    ],
    related: ['pendencias', 'notas-fiscais', 'apuracao'],
  },
  {
    id: 'apuracao',
    title: 'Apuração',
    group: 'Obrigações e controles',
    route: '/apuracao',
    summary: 'Faturamento, RBT12, impostos estimados e fechamento do mês de cada empresa da carteira.',
    sections: [
      {
        title: 'Como usar',
        items: [
          'As setas trocam o mês; os chips filtram por regime; os atalhos mostram as empresas com alerta, sem nota de saída, a fechar e fechadas.',
          'Clique numa empresa para ver o detalhe do mês, os 13 meses anteriores e fechar o período.',
        ],
      },
      {
        title: 'Limites',
        items: [
          'É uma estimativa pelas notas importadas (canceladas fora).',
          'Não considera folha (fator R), segregação de ST/monofásico nem receita sem nota — confira no PGDAS/DCTFWeb antes de emitir a guia.',
        ],
      },
    ],
    related: ['empresas'],
  },
  {
    id: 'relatorios',
    title: 'Relatórios e simulação de regimes',
    group: 'Obrigações e controles',
    route: '/relatorios',
    summary: 'Relatório mensal para o cliente, curva ABC de compras e simulação de Simples × Presumido × Real com os números das notas.',
    sections: [
      {
        title: 'Relatório mensal',
        items: [
          'Faturamento, impostos estimados (os mesmos da Apuração), compras, entradas e saídas por CFOP, retenções, pendências abertas, achados da auditoria e a evolução de 13 meses.',
          '"Relatório PDF" gera a versão para enviar ao cliente.',
        ],
      },
      {
        title: 'Curva ABC de compras',
        items: [
          'As compras (notas de entrada, canceladas fora) dos últimos 3, 6 ou 12 meses, por produto ou por fornecedor, do maior para o menor valor.',
          'Curva A: o que soma até 80% do valor; B: até 95%; C: o restante.',
        ],
      },
      {
        title: 'Simulação de regimes',
        items: [
          'Roda as regras da Apuração nos 12 meses até a competência como se a empresa fosse do Simples Nacional, do Lucro Presumido e do Lucro Real, e destaca o de menor carga.',
          'Fora do Simples entram o ISS (alíquota informada) sobre os serviços e o saldo de ICMS destacado nas notas (saídas menos entradas); no Lucro Real, IRPJ e CSLL sobre uma margem de lucro informada.',
          'É uma estimativa: não considera folha (fator R), receitas sem nota, ST/monofásico nem benefícios fiscais. As premissas aparecem embaixo do resultado.',
        ],
      },
    ],
    related: ['apuracao', 'retencoes'],
  },
  {
    id: 'empresas',
    title: 'Empresas, certificado A1 e captura SEFAZ',
    group: 'Configuração',
    route: '/cadastro/empresas',
    summary: 'Cadastro das empresas, regime tributário, certificado A1 e a captura de notas direto na SEFAZ.',
    sections: [
      {
        title: 'Regime tributário',
        paragraphs: [
          'Informe o regime (com o histórico por período). Ele é usado na Apuração, nas checagens e nas Retenções (como compensar). Sem regime a empresa ganha uma pendência.',
        ],
      },
      {
        title: 'Certificado A1',
        items: [
          'Envie o .pfx com a senha; o arquivo e a senha são guardados cifrados. Uma filial usa o certificado da matriz (mesma raiz de CNPJ).',
          'O certificado é usado na captura pela SEFAZ e para assinar a Ciência e a manifestação.',
          'Vencido ou vencendo em 30 dias vira pendência.',
        ],
      },
      {
        title: 'Captura pela SEFAZ',
        items: [
          'Roda de hora em hora para as empresas com certificado e "Integração SEFAZ" no plano, de qualquer estado. "Capturar agora" roda na hora, respeitando a pausa de 1h que a SEFAZ exige.',
          'O painel "Entradas que a SEFAZ entregou só como resumo" mostra as notas ainda sem XML e a situação da Ciência de cada uma; "Reenviar ciência" recoloca na fila uma ciência recusada.',
          'Captura de NFS-e pelo Ambiente Nacional: com "Integração NFS-e Nacional" no plano, roda de hora em hora com o mesmo certificado; o status e o botão "Capturar NFS-e agora" ficam na mesma seção.',
        ],
      },
    ],
    related: ['manifestacao', 'planos'],
  },
  {
    id: 'regras-fiscais',
    title: 'Regras fiscais por produto e retificação',
    group: 'Configuração',
    summary: 'Regras de CFOP, NCM e tributos por produto (e fornecedor), as divergências e a retificação do XML.',
    sections: [
      {
        title: 'Regras',
        items: [
          'Ficam no cadastro da empresa. Uma regra vale para um código de produto — de todos os fornecedores ou de um fornecedor específico (a do fornecedor tem preferência).',
          'O 1º dígito do CFOP segue a operação de cada nota: uma regra 1102 vale como 2102 numa compra interestadual.',
          '"Sugerir regras" propõe regras a partir das notas recebidas, já com o CFOP de entrada equivalente.',
        ],
      },
      {
        title: 'Divergências e retificação',
        items: [
          'Notas de entrada que não batem com a regra aparecem na aba Divergências da nota.',
          '"Retificar" gera uma versão do XML com o CFOP/NCM da regra; as exportações passam a usar essa versão. O DANFE continua mostrando o que foi emitido.',
          'Notas emitidas pela própria empresa não são checadas nem retificadas.',
        ],
      },
    ],
    related: ['notas-fiscais'],
  },
  {
    id: 'planos',
    title: 'Planos e serviços',
    group: 'Configuração',
    route: '/cadastro/planos',
    summary: 'O que cada serviço do plano liga para as empresas que o assinam.',
    sections: [
      {
        title: 'Serviços',
        items: [
          'Importação de XML fiscal: coloca a empresa na importação automática. A fonte vem das integrações abaixo.',
          'Integração SIEG: NF-e (entradas e saídas) e NFS-e pelo SIEG.',
          'Integração SEFAZ (certificado A1): captura das entradas direto na SEFAZ.',
          'Integração NFS-e Nacional: captura das NFS-e prestadas e tomadas direto no Ambiente Nacional, com o certificado A1.',
          'Manifestação do destinatário: Ciência automática na SEFAZ e a tela de Manifestação (precisa da Integração SEFAZ).',
          'Auditoria de notas fiscais: a Auditoria tipo malha roda sozinha todo dia para a empresa.',
          'Acesso multiusuário e Relatórios.',
        ],
      },
    ],
    related: ['empresas'],
  },
];

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'ABRASF', definition: 'Layout de NFS-e usado por muitos municípios antes do padrão nacional. O sistema lê as versões 1.0 e 2.x.' },
  { term: 'Ciência da Operação', definition: 'Evento 210210 em que o destinatário diz à SEFAZ que sabe da nota. Libera o XML completo, mas não conclui a manifestação.' },
  { term: 'Competência', definition: 'O mês a que um valor pertence (ex.: 2026-10). Nas retenções é o mês da nota; nas NFS-e, a competência informada nela.' },
  { term: 'Confirmação da Operação', definition: 'Evento 210200: o destinatário confirma que recebeu a mercadoria. É uma manifestação conclusiva.' },
  { term: 'Desconhecimento da Operação', definition: 'Evento 210220: o destinatário não reconhece a nota (possível uso indevido do CNPJ). O emitente é avisado.' },
  { term: 'Distribuição DF-e', definition: 'Serviço da SEFAZ (NFeDistribuicaoDFe) que entrega, com o certificado A1, as notas em que a empresa é interessada.' },
  { term: 'Manifestação conclusiva', definition: 'Confirmação, Desconhecimento ou Operação não Realizada — a resposta que o destinatário deve dar em até 180 dias.' },
  { term: 'NFS-e nacional', definition: 'NFS-e no padrão do Ambiente Nacional (Sistema Nacional NFS-e), com chave de acesso de 50 dígitos.' },
  { term: 'NSU', definition: 'Número sequencial único da distribuição: a SEFAZ entrega os documentos em sequência e o sistema continua do último NSU lido.' },
  { term: 'Operação não Realizada', definition: 'Evento 210240: a operação foi acordada mas não aconteceu (devolução, recusa no recebimento). Exige justificativa.' },
  { term: 'Origem', definition: 'De onde a nota veio primeiro: SIEG, SEFAZ ou upload manual.' },
  { term: 'Prestada / tomada', definition: 'Na NFS-e: prestada quando a empresa é a prestadora do serviço; tomada quando ela contratou o serviço.' },
  { term: 'RBT12', definition: 'Receita bruta dos 12 meses anteriores — base das faixas do Simples Nacional.' },
  { term: 'Resumo (resNFe)', definition: 'O que a SEFAZ entrega ao destinatário antes da Ciência: chave, emitente, valor e data — sem itens. A nota fica "só resumo" até o XML completo chegar.' },
  { term: 'Retificação', definition: 'Versão do XML gerada pelo sistema com o CFOP/NCM das regras. As exportações usam essa versão; o original é preservado.' },
  { term: 'retTrib', definition: 'Grupo de retenções federais da NF-e (PIS, COFINS, CSLL, IRRF e INSS retidos).' },
];

export const FAQ: FaqEntry[] = [
  {
    question: 'Por que uma nota de entrada aparece só com resumo?',
    answer: 'A SEFAZ só libera o XML completo ao destinatário depois de uma manifestação. Com "Manifestação do destinatário" no plano o Taxify envia a Ciência sozinho e busca o XML na captura seguinte; sem ela, a nota fica completa quando vier pelo SIEG ou por upload.',
    articleId: 'manifestacao',
  },
  {
    question: 'Por que a captura pela SEFAZ não roda para uma empresa?',
    answer: 'Ela precisa de certificado A1 válido (dela ou da matriz), de UF coberta pela captura e de "Importação de XML fiscal" + "Integração SEFAZ" no plano. O status da última captura fica no cadastro da empresa e em Pendências.',
    articleId: 'empresas',
  },
  {
    question: 'Por que uma retenção saiu como "provável indevida"?',
    answer: 'A empresa prestadora é do Simples Nacional e a nota traz retenção de IRRF, PIS, COFINS ou CSLL — retenções que, salvo exceções, não se aplicam ao Simples. Confira e, se for o caso, peça o ajuste ao tomador.',
    articleId: 'retencoes',
  },
  {
    question: 'Resolvi uma pendência e ela voltou. Por quê?',
    answer: 'Se a causa desaparece e depois aparece de novo (ex.: um novo certificado também vencendo), a pendência reabre. Enquanto a causa continuar a mesma, uma pendência fechada à mão fica fechada.',
    articleId: 'pendencias',
  },
  {
    question: 'As NFS-e de um mês antigo não aparecem.',
    answer: 'A busca diária no SIEG cobre os últimos 35 dias. Em Notas de serviço, vá até o mês e use "Buscar este mês no SIEG" — roda em segundo plano e pode levar alguns minutos.',
    articleId: 'notas-servico',
  },
  {
    question: 'Qual a diferença entre Desconhecimento e Operação não Realizada?',
    answer: 'Desconhecimento é para nota que a empresa não reconhece. Operação não Realizada é para uma operação que existiu, mas não se concretizou (devolução, recusa no recebimento) — e exige justificativa.',
    articleId: 'manifestacao',
  },
];

/** Um passo de um tutorial: o que fazer e, quando há, a tela onde se faz. */
export interface TutorialStep {
  title: string;
  text: string;
  route?: string;
  /** Rótulo do botão que abre a tela (padrão: "Abrir a tela"). */
  routeLabel?: string;
}

/** Um fluxo de trabalho de ponta a ponta, que atravessa várias telas. */
export interface HelpTutorial {
  id: string;
  title: string;
  summary: string;
  minutes: number;
  prerequisites: string[];
  steps: TutorialStep[];
  /** O que costuma dar errado e como sair. */
  pitfalls?: string[];
  /** Artigos relacionados (ids). */
  related?: string[];
}

export const HELP_TUTORIALS: HelpTutorial[] = [
  {
    id: 'tutorial-nova-empresa',
    title: 'Cadastrar uma empresa nova',
    summary: 'Do cadastro até as notas chegando sozinhas: dados, regime, certificado A1, plano e quem atende a empresa.',
    minutes: 10,
    prerequisites: [
      'CNPJ, inscrição estadual (quando houver) e regime tributário da empresa.',
      'O certificado A1 da empresa (.pfx) e a senha — ou o da matriz, que vale para as filiais.',
    ],
    steps: [
      {
        title: 'Crie a empresa',
        text: 'Em Empresas, use "Nova empresa" e preencha documento, nome, inscrição estadual e municipal, CNAE e endereço. A UF decide telas como a Fronteira PE.',
        route: '/cadastro/empresas',
        routeLabel: 'Abrir Empresas',
      },
      {
        title: 'Informe o regime tributário',
        text: 'Na seção de regime, escolha o regime e a data a partir da qual ele vale. Ele é usado na Apuração, nas checagens e nas Retenções; sem regime a empresa ganha uma pendência.',
      },
      {
        title: 'Envie o certificado A1',
        text: 'Em "Certificado A1 e captura pela SEFAZ", envie o .pfx com a senha (ficam guardados cifrados). Ele é usado na captura de notas e para assinar a Ciência e a manifestação.',
      },
      {
        title: 'Assine um plano',
        text: 'Em Assinaturas, use "Nova assinatura" e escolha o plano. Os serviços do plano ligam as integrações: Importação de XML fiscal, SIEG, SEFAZ, NFS-e Nacional, Manifestação e Auditoria.',
      },
      {
        title: 'Vincule quem atende a empresa',
        text: 'Em Usuários, abra o usuário e use "Vincular empresa". A empresa passa a aparecer na carteira dele (Apuração, Pendências, Retenções).',
        route: '/cadastro/usuarios',
        routeLabel: 'Abrir Usuários',
      },
      {
        title: 'Confira se as notas estão chegando',
        text: 'No cadastro da empresa, "Capturar agora" roda a captura pela SEFAZ na hora (respeitando a pausa de 1h da SEFAZ). Depois veja as notas em Notas fiscais e a situação das coletas em Pendências → Saúde das integrações.',
        route: '/pendencias',
        routeLabel: 'Abrir Pendências',
      },
    ],
    pitfalls: [
      'A captura não roda: falta certificado válido, ou o plano não tem "Importação de XML fiscal" + "Integração SEFAZ".',
      'Filial sem certificado próprio usa o da matriz (mesma raiz de CNPJ) — não precisa enviar de novo.',
      'A SEFAZ não entrega as notas emitidas pela própria empresa: as saídas vêm pelo SIEG ou por upload.',
    ],
    related: ['empresas', 'planos'],
  },
  {
    id: 'tutorial-fronteira',
    title: 'Conferir a Fronteira PE do mês',
    summary: 'O ICMS antecipado que o e-Fisco cobra, conferido nota a nota: buscar o extrato, ver o que diverge, comparar com a memória do e-Fisco e decidir.',
    minutes: 15,
    prerequisites: [
      'Empresa de Pernambuco, com a inscrição estadual no cadastro.',
      'O certificado do contador (e-CPF A1) cadastrado nas Integrações do escritório — para o Taxify buscar o extrato e a memória sozinho.',
      'As notas de entrada do mês importadas (XML completo).',
    ],
    steps: [
      {
        title: 'Cadastre o certificado do contador (uma vez só)',
        text: 'No botão "Editar dados do escritório" (canto superior), seção Integrações → "e-Fisco PE · certificado do contador", envie o e-CPF A1. Com ele, o Taxify busca o extrato de todas as empresas de PE todo dia às 7h.',
      },
      {
        title: 'Escolha o mês e a empresa',
        text: 'Na Fronteira PE, escolha o mês nas setas e a empresa. Se o extrato do mês ainda não veio, use "Sincronizar com e-Fisco" (ou "Importar extrato do e-Fisco" com o PDF baixado à mão).',
        route: '/fronteira',
        routeLabel: 'Abrir Fronteira PE',
      },
      {
        title: 'Leia o resumo',
        text: 'Os cartões mostram o cobrado no extrato, o cálculo do Taxify, o cobrado a mais e o cobrado a menos. Os atalhos filtram a lista: cobrou a mais, confere, divergência fiscal, taxa diferente.',
      },
      {
        title: 'Abra o "Ver cálculo" das notas que divergem',
        text: 'O modal mostra o Taxify, o cobrado e a diferença. Em "Buscar cálculo do e-Fisco", o Taxify traz a memória do e-Fisco e compara etapa por etapa: base de partida, agregação, carga líquida ou alíquotas e o ICMS. O que difere fica destacado.',
      },
      {
        title: 'Decida: adotar ou contestar',
        text: 'Se o e-Fisco estiver certo, "Adotar o cálculo do e-Fisco" abre a regra já preenchida para as próximas notas — confira e salve. Se o Taxify estiver certo, use o PDF do extrato ("Ver PDF") e a memória para pedir a revisão.',
      },
      {
        title: 'Confira as regras "a conferir"',
        text: 'Em "Tabela de ICMS e fórmulas", as regras novas ou alteradas ficam "a conferir" até o time fiscal marcar. Enquanto isso, os resultados que as usam também aparecem "a conferir".',
      },
    ],
    pitfalls: [
      '"Sem regra": algum item não tem alíquota ou regra na tabela — nunca vira "cobrou a mais"; cadastre a regra.',
      '"Pendente": a nota não tem o XML completo (só o resumo da SEFAZ). Veja a Manifestação.',
      'O e-Fisco calcula por mercadoria dele, não item a item: numa nota com vários itens ele pode mostrar um grupo só; a comparação usa a soma dos itens.',
      'Desafio do Cloudflare ou login recusado param a sincronização e o motivo aparece na tela: tente mais tarde ou importe o PDF à mão.',
    ],
    related: ['fronteira', 'notas-fiscais'],
  },
  {
    id: 'tutorial-notas-mes',
    title: 'Importar e auditar as notas do mês',
    summary: 'Garantir que todas as notas do mês chegaram, conferir as divergências e deixar a malha limpa.',
    minutes: 15,
    prerequisites: ['Empresa com plano de Importação de XML fiscal e as integrações (SIEG e/ou SEFAZ).'],
    steps: [
      {
        title: 'Veja se tudo chegou',
        text: 'Em Notas fiscais, escolha a empresa e o período. Os cartões de entradas e saídas mostram os totais. O filtro "Origem" com "Só no SIEG" / "Só na SEFAZ" mostra as notas que estão numa fonte e não na outra há mais de 48h.',
        route: '/notas-fiscais',
        routeLabel: 'Abrir Notas fiscais',
      },
      {
        title: 'Importe o que faltar',
        text: '"Importar XML" aceita um XML ou um .zip. A mesma nota vinda de mais de uma fonte é guardada uma vez só; NFS-e enviadas por aqui vão para Notas de serviço.',
      },
      {
        title: 'Trate as divergências',
        text: 'O chip de divergência mostra as entradas que não batem com as regras fiscais por produto. Abra a nota, veja a aba Divergências e, se for o caso, use "Retificar" para gerar o XML com o CFOP/NCM da regra.',
      },
      {
        title: 'Confira as notas',
        text: 'Marque cada nota como conferida ou com divergência — ou "Marcar N da página como conferidas" para conferir em lote. Nota conferida com divergência vira pendência.',
      },
      {
        title: 'Rode a auditoria do mês',
        text: 'Em Auditoria, escolha a competência e a empresa. Ela roda sozinha todo dia às 05:30; "Rodar auditoria" roda na hora. Os achados aparecem por grupo e viram pendências.',
        route: '/auditoria',
        routeLabel: 'Abrir Auditoria',
      },
      {
        title: 'Gere o laudo',
        text: '"Laudo PDF" e "Exportar CSV" trazem os achados do mês com os fundamentos — para guardar ou mostrar ao cliente.',
      },
    ],
    pitfalls: [
      'Entrada que aparece só com resumo: falta a manifestação — veja o tutorial de Manifestação.',
      'Notas canceladas aparecem na lista mas ficam fora dos totais.',
      'Achados de uma regra "a conferir" são indícios ainda não validados pelo time fiscal.',
    ],
    related: ['notas-fiscais', 'regras-fiscais', 'auditoria'],
  },
  {
    id: 'tutorial-manifestacao',
    title: 'Fazer a manifestação do destinatário',
    summary: 'Responder à SEFAZ sobre as notas de entrada dentro do prazo e liberar o XML completo das que vieram só com resumo.',
    minutes: 5,
    prerequisites: [
      'Plano com "Manifestação do destinatário" (junto com "Integração SEFAZ").',
      'Certificado A1 válido da empresa (ou da matriz).',
    ],
    steps: [
      {
        title: 'Abra a lista da empresa',
        text: 'Em Manifestação, escolha a empresa. A lista traz as notas dos últimos 180 dias sem manifestação conclusiva, com o prazo mais próximo primeiro.',
        route: '/manifestacao',
        routeLabel: 'Abrir Manifestação',
      },
      {
        title: 'Comece pelos prazos',
        text: 'O atalho de prazo mostra as notas que vencem em breve. Os outros separam as sem ciência, as só com ciência e as que vieram só com o resumo.',
      },
      {
        title: 'Marque e envie',
        text: 'Marque as notas e use o botão certo: "Confirmar operação" (recebi), "Só ciência" (libera o XML, mas não conclui), "Não realizada" (a operação não aconteceu — pede justificativa de 15 a 255 caracteres) ou "Desconhecer" (não reconheço a nota). Até 100 notas por vez.',
      },
      {
        title: 'Veja o retorno',
        text: 'A SEFAZ responde nota a nota: as registradas saem da lista; as recusadas mostram o motivo na linha.',
      },
      {
        title: 'Confira o XML completo',
        text: 'A nota que só tinha o resumo é liberada pela manifestação e o XML completo chega na captura seguinte — aí ela entra em Notas fiscais com os itens.',
        route: '/notas-fiscais',
        routeLabel: 'Abrir Notas fiscais',
      },
    ],
    pitfalls: [
      'O evento fica registrado na SEFAZ e o emitente vê — não dá para desfazer.',
      'Devolução ou recusa no recebimento é "Não realizada", não "Desconhecer".',
      'Prazo em até 15 dias vira pendência alta.',
    ],
    related: ['manifestacao', 'notas-fiscais'],
  },
  {
    id: 'tutorial-fechamento',
    title: 'Fechar a apuração e as retenções do mês',
    summary: 'O fechamento mensal da carteira: impostos estimados, retenções a recolher e a compensar e o relatório para o cliente.',
    minutes: 20,
    prerequisites: ['As notas do mês importadas (NF-e e NFS-e).', 'O regime tributário de cada empresa informado.'],
    steps: [
      {
        title: 'Revise as retenções',
        text: 'Em Retenções, a competência padrão é o mês anterior; sem empresa escolhida aparece a carteira toda. Veja o que recolher (com o vencimento) e o que compensar. O atalho "provável indevida" mostra retenções de prestador do Simples que merecem ajuste.',
        route: '/retencoes',
        routeLabel: 'Abrir Retenções',
      },
      {
        title: 'Marque o que já foi conferido',
        text: 'Marque as linhas e use "Marcar como conferidas" (fica registrado quem e quando). "Exportar CSV" gera a planilha para emitir as guias.',
      },
      {
        title: 'Confira a apuração da carteira',
        text: 'Em Apuração, as setas trocam o mês e os atalhos mostram as empresas com alerta, sem nota de saída, a fechar e fechadas.',
        route: '/apuracao',
        routeLabel: 'Abrir Apuração',
      },
      {
        title: 'Feche o mês de cada empresa',
        text: 'Clique na empresa para ver o detalhe do mês e os 13 meses anteriores e feche o período.',
      },
      {
        title: 'Envie o relatório ao cliente',
        text: 'Em Relatórios, o relatório mensal traz faturamento, impostos, compras, CFOPs, retenções, pendências e achados. "Relatório PDF" gera a versão para enviar.',
        route: '/relatorios',
        routeLabel: 'Abrir Relatórios',
      },
    ],
    pitfalls: [
      'A apuração é uma estimativa pelas notas: não considera folha (fator R), segregação de ST/monofásico nem receita sem nota — confira no PGDAS/DCTFWeb antes de emitir a guia.',
      'Feriados não entram no vencimento; o ISS vence conforme o município.',
    ],
    related: ['retencoes', 'apuracao', 'relatorios'],
  },
  {
    id: 'tutorial-pendencias',
    title: 'Tratar pendências e achados da auditoria',
    summary: 'Zerar o que falta na carteira por prioridade, registrando o porquê de cada decisão.',
    minutes: 10,
    prerequisites: ['Empresas atribuídas a você (a carteira).'],
    steps: [
      {
        title: 'Abra as pendências da carteira',
        text: 'Em Pendências, deixe a empresa vazia para ver toda a carteira, ou escolha uma. Os chips filtram por situação e severidade; os cartões, por tipo. Comece pelas de severidade alta.',
        route: '/pendencias',
        routeLabel: 'Abrir Pendências',
      },
      {
        title: 'Resolva a causa',
        text: 'Abra a pendência para ir até a tela da causa (certificado, nota, manifestação, retenção). Quando a causa some, a pendência fecha sozinha no próximo recálculo (de hora em hora, ou "Atualizar agora").',
      },
      {
        title: 'Resolva ou desconsidere à mão quando for o caso',
        text: '"Resolver" e "Desconsiderar" pedem um comentário e registram quem e quando. Uma pendência fechada à mão fica fechada enquanto a causa for a mesma.',
      },
      {
        title: 'Trate os achados da auditoria',
        text: 'Em Auditoria, os achados aparecem por grupo, com o fundamento. Resolva, desconsidere ou reabra — o mesmo achado é a pendência em Pendências.',
        route: '/auditoria',
        routeLabel: 'Abrir Auditoria',
      },
      {
        title: 'Acompanhe as integrações',
        text: 'Embaixo, em Pendências, a saúde das integrações mostra a última coleta da SEFAZ e da NFS-e Nacional de cada empresa e as falhas dos últimos 7 dias.',
      },
    ],
    pitfalls: [
      'Pendência que volta: a causa apareceu de novo (ex.: um novo certificado também vencendo).',
      'Uma regra da auditoria pode ser desativada na visão "Regras" — os achados dela saem das próximas auditorias.',
    ],
    related: ['pendencias', 'auditoria'],
  },
];

export function findTutorial(id: string | null | undefined): HelpTutorial | undefined {
  return HELP_TUTORIALS.find((tutorial) => tutorial.id === id);
}

export function findArticle(id: string | null | undefined): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}
