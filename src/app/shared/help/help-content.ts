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
          'Roda de hora em hora para as empresas com certificado e "Integração SEFAZ" no plano (por enquanto, de Pernambuco). "Capturar agora" roda na hora, respeitando a pausa de 1h que a SEFAZ exige.',
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
          'Auditoria de notas fiscais, Acesso multiusuário e Relatórios.',
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

export function findArticle(id: string | null | undefined): HelpArticle | undefined {
  return HELP_ARTICLES.find((article) => article.id === id);
}
