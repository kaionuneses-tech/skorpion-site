/* =====================================================================
   SKORPION — Configuração do site
   >>> ESTE É O ÚNICO ARQUIVO QUE VOCÊ PRECISA EDITAR PARA PUBLICAR. <<<

   Tudo que estiver entre colchetes [ ... ] é um PLACEHOLDER.
   No site, esses textos aparecem destacados em amarelo até serem trocados.
   ===================================================================== */

const SKORPION = {

  /* ---------------------------------------------------------------
     1. SUPABASE
     Painel do Supabase → botão "Connect" (ou Settings → API Keys)
     - url     = "Project URL"
     - anonKey = "Publishable key" (sb_publishable_...) ou a antiga "anon public".
                 Pode ficar no front, é protegida por RLS. NUNCA a secret/service_role.
     --------------------------------------------------------------- */
  supabase: {
    url:     'https://jqjfaijudhigtidodhei.supabase.co',
    anonKey: 'sb_publishable_fCYpY4PjCxUrsFvVw2d7Tg_eHTLjATT'
  },

  /* ---------------------------------------------------------------
     2. DADOS DA EMPRESA
     --------------------------------------------------------------- */
  empresa: {
    nome:         'Skorpion',
    tagline:      'Trading & Distribuição',
    razaoSocial:  'Skorpion Importações e Exportações Ltda',
    cnpj:         '39.696.826/0001-72',

    telefone:     '(27) 99823-5066',
    // Só dígitos, com DDI 55. Ex.: '5511999999999' — usado nos links do WhatsApp.
    whatsapp:     '5527998235066',
    whatsappLabel:'(27) 99823-5066',

    email:        'financeiro@skorpionimportexport.com.br',
    emailComercial: 'financeiro@skorpionimportexport.com.br',

    endereco:     'Rua Porto Alegre, 317 — Sala 102',
    bairro:       'Itapuã',
    cidadeUf:     'Vila Velha / ES',
    cep:          'CEP 29101-680',

    horario:      'Segunda a sexta, das 8h às 18h',

    // Pessoa responsável pelos dados pessoais (LGPD) — aparece em privacidade.html.
    encarregado:  '[Nome do encarregado de dados]',

    linkedin:     '',   // deixe '' para esconder o link
    instagram:    ''
  },

  /* ---------------------------------------------------------------
     3. NÚMEROS DA EMPRESA (barra de credibilidade da home)
     Troque os valores entre colchetes pelos números reais.
     --------------------------------------------------------------- */
  // shortcut: países, processos e clientes são estimativas provisórias — troque pelos números reais.
  numeros: [
    { valor: '6',   sufixo: '',  rotulo: 'anos de atuação em comércio exterior' },
    { valor: '8',   sufixo: '+', rotulo: 'países de origem já operados' },
    { valor: '150', sufixo: '+', rotulo: 'processos de importação concluídos' },
    { valor: '90',  sufixo: '+', rotulo: 'clientes atendidos no Brasil' }
  ],

  /* ---------------------------------------------------------------
     4. TEXTOS AJUSTÁVEIS
     --------------------------------------------------------------- */
  textos: {
    heroTitulo:   'Comércio exterior sem<br>atrito para a sua empresa.',
    heroSubtitulo:'A Skorpion cuida do processo de importação de ponta a ponta e ' +
                  'também distribui produtos importados no atacado. Duas frentes, ' +
                  'uma mesma estrutura técnica e um só interlocutor.',
    sobreResumo:  'A Skorpion nasceu para tirar a complexidade do caminho entre ' +
                  'o fornecedor lá fora e a operação do cliente aqui dentro.'
  }
};

/* Congelado para evitar alteração acidental em runtime. */
Object.freeze(SKORPION);
