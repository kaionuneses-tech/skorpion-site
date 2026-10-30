/* =====================================================================
   SKORPION — admin.html
   Login por e-mail/senha (Supabase Auth), CRUD de categorias e produtos
   (com compressão de fotos) e gestão das duas filas de solicitações.
   ===================================================================== */

(function () {
  'use strict';

  const STATUS = {
    novo:           'Novo',
    em_atendimento: 'Em atendimento',
    fechado:        'Fechado',
    perdido:        'Perdido'
  };

  const MAX_DIM = 1200;          // maior lado da foto depois da compressão
  const QUALIDADE = 0.82;        // qualidade do JPEG
  const BUCKET = 'produtos';

  let sb = null;
  let categorias = [];
  let produtos = [];
  let fotosAtuais = [];          // URLs já enviadas, na ordem de exibição

  /* ==================================================================
     1. Autenticação
     ================================================================== */
  const telaLogin  = document.getElementById('tela-login');
  const telaAdmin  = document.getElementById('tela-admin');
  const formLogin  = document.getElementById('form-login');
  const alertaLogin = document.getElementById('login-alerta');

  async function iniciar() {
    sb = SK.db();
    if (!sb) {
      SK.avisoConfig(alertaLogin);
      formLogin.querySelector('button').disabled = true;
      return;
    }

    const { data } = await sb.auth.getSession();
    if (data && data.session) entrarNoPainel(data.session);

    sb.auth.onAuthStateChange((evento, sessao) => {
      if (evento === 'SIGNED_OUT' || !sessao) mostrarLogin();
    });
  }

  function mostrarLogin() {
    telaAdmin.classList.add('hide');
    telaLogin.style.display = '';
  }

  function entrarNoPainel(sessao) {
    telaLogin.style.display = 'none';
    telaAdmin.classList.remove('hide');
    document.getElementById('usuario-email').textContent =
      (sessao.user && sessao.user.email) || '';
    carregarTudo();
  }

  formLogin.addEventListener('submit', async function (e) {
    e.preventDefault();
    alertaLogin.innerHTML = '';
    if (!SK.validarFormulario(formLogin)) return;

    const btn = document.getElementById('btn-login');
    SK.botaoCarregando(btn, true);
    btn.innerHTML = '<span class="spinner"></span> Entrando...';

    const { data, error } = await sb.auth.signInWithPassword({
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-senha').value
    });

    SK.botaoCarregando(btn, false);
    btn.innerHTML = 'Entrar';

    if (error) {
      alertaLogin.innerHTML =
        '<div class="alert alert--error">' +
        (error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : SK.escapeHtml(error.message)) +
        '</div>';
      return;
    }
    entrarNoPainel(data.session);
  });

  document.getElementById('btn-sair').addEventListener('click', async () => {
    await sb.auth.signOut();
    location.reload();
  });

  /* ==================================================================
     2. Abas
     ================================================================== */
  document.querySelectorAll('.tab-btn').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((x) => x.classList.remove('is-active'));
      document.querySelectorAll('.tab-panel').forEach((x) => x.classList.remove('is-active'));
      b.classList.add('is-active');
      document.querySelector('[data-panel="' + b.dataset.tab + '"]').classList.add('is-active');
    });
  });

  document.querySelectorAll('[data-recarregar]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.recarregar === 'importacao') carregarSolicitacoes('importacao');
      else carregarSolicitacoes('revenda');
    });
  });

  /* ==================================================================
     3. Carregamento
     ================================================================== */
  /** Busca categorias e produtos juntos: a tabela de categorias mostra a
      contagem de produtos, então as duas listas precisam chegar antes do render. */
  async function carregarTudo() {
    await Promise.all([carregarCategorias(), carregarProdutos()]);
    renderCategorias();
    renderProdutos();
    carregarSolicitacoes('importacao');
    carregarSolicitacoes('revenda');
  }

  /* --------------------------- Categorias --------------------------- */
  async function carregarCategorias() {
    const { data, error } = await sb
      .from('categorias')
      .select('*')
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });

    if (error) {
      document.getElementById('tabela-categorias').innerHTML = erroHtml(error);
      return;
    }
    categorias = data || [];

    // Alimenta o select do modal de produto
    const sel = document.getElementById('prod-categoria');
    sel.innerHTML = '<option value="">Sem categoria</option>' +
      categorias.map((c) =>
        '<option value="' + SK.escapeHtml(c.id) + '">' + SK.escapeHtml(c.nome) +
        (c.ativo ? '' : ' (inativa)') + '</option>').join('');
  }

  function renderCategorias() {
    const box = document.getElementById('tabela-categorias');

    if (!categorias.length) {
      box.innerHTML = vazioHtml('Nenhuma categoria cadastrada',
        'As categorias organizam o catálogo e alimentam o filtro da página de produtos.');
      return;
    }

    box.innerHTML =
      '<div class="table-wrap"><table class="data">' +
        '<thead><tr><th>Nome</th><th>Slug</th><th>Ordem</th><th>Produtos</th><th>Status</th><th></th></tr></thead>' +
        '<tbody>' +
        categorias.map((c) => {
          const qtd = produtos.filter((p) => p.categoria_id === c.id).length;
          return '<tr>' +
            '<td><strong>' + SK.escapeHtml(c.nome) + '</strong>' +
              (c.descricao ? '<br><span class="small muted">' + SK.escapeHtml(c.descricao) + '</span>' : '') +
            '</td>' +
            '<td><span class="small muted">' + SK.escapeHtml(c.slug || '—') + '</span></td>' +
            '<td>' + c.ordem + '</td>' +
            '<td>' + qtd + '</td>' +
            '<td>' + (c.ativo
              ? '<span class="tag tag--green">Ativa</span>'
              : '<span class="tag tag--gray">Inativa</span>') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn--outline btn--sm" data-editar-cat="' + SK.escapeHtml(c.id) + '">Editar</button> ' +
              '<button class="btn btn--danger btn--sm" data-excluir-cat="' + SK.escapeHtml(c.id) + '">Excluir</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table></div>';

    box.querySelectorAll('[data-editar-cat]').forEach((b) =>
      b.addEventListener('click', () => abrirModalCategoria(b.dataset.editarCat)));
    box.querySelectorAll('[data-excluir-cat]').forEach((b) =>
      b.addEventListener('click', () => excluirCategoria(b.dataset.excluirCat)));
  }

  /* ---------------------------- Produtos ---------------------------- */
  async function carregarProdutos() {
    const { data, error } = await sb
      .from('produtos')
      .select('*')
      .order('destaque', { ascending: false })
      .order('ordem', { ascending: true })
      .order('nome', { ascending: true });

    if (error) {
      document.getElementById('tabela-produtos').innerHTML = erroHtml(error);
      return;
    }
    produtos = data || [];
  }

  function renderProdutos() {
    const box = document.getElementById('tabela-produtos');
    const termo = (document.getElementById('busca-produtos').value || '').trim().toLowerCase();
    const lista = termo
      ? produtos.filter((p) =>
          (p.nome + ' ' + (p.descricao || '')).toLowerCase().includes(termo))
      : produtos;

    if (!produtos.length) {
      box.innerHTML = vazioHtml('Nenhum produto cadastrado',
        'Cadastre o primeiro item para o catálogo de revenda aparecer no site.');
      return;
    }
    if (!lista.length) {
      box.innerHTML = vazioHtml('Nenhum produto encontrado', 'Tente outro termo de busca.');
      return;
    }

    box.innerHTML =
      '<div class="table-wrap"><table class="data">' +
        '<thead><tr><th style="width:74px">Foto</th><th>Produto</th><th>Categoria</th>' +
        '<th>Unidade / mínimo</th><th>Status</th><th></th></tr></thead><tbody>' +
        lista.map((p) => {
          const foto = Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null;
          const cat = categorias.find((c) => c.id === p.categoria_id);
          return '<tr>' +
            '<td>' + (foto
              ? '<img src="' + SK.escapeHtml(foto) + '" alt="" style="width:56px;height:44px;object-fit:cover;border-radius:6px">'
              : '<div style="width:56px;height:44px;border-radius:6px;background:var(--bg-soft)"></div>') +
            '</td>' +
            '<td><strong>' + SK.escapeHtml(p.nome) + '</strong>' +
              (p.destaque ? ' <span class="tag tag--amber">Destaque</span>' : '') +
              '<br><span class="small muted">' +
              (Array.isArray(p.fotos) ? p.fotos.length : 0) + ' foto(s)</span></td>' +
            '<td>' + (cat ? SK.escapeHtml(cat.nome) : '<span class="muted">—</span>') + '</td>' +
            '<td><span class="small">' +
              SK.escapeHtml(p.unidade_venda || '—') + '<br>' +
              '<span class="muted">mín. ' + SK.escapeHtml(p.pedido_minimo || '—') + '</span>' +
            '</span></td>' +
            '<td>' + (p.ativo
              ? '<span class="tag tag--green">Ativo</span>'
              : '<span class="tag tag--gray">Inativo</span>') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="btn btn--outline btn--sm" data-editar-prod="' + SK.escapeHtml(p.id) + '">Editar</button> ' +
              '<button class="btn btn--danger btn--sm" data-excluir-prod="' + SK.escapeHtml(p.id) + '">Excluir</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table></div>';

    box.querySelectorAll('[data-editar-prod]').forEach((b) =>
      b.addEventListener('click', () => abrirModalProduto(b.dataset.editarProd)));
    box.querySelectorAll('[data-excluir-prod]').forEach((b) =>
      b.addEventListener('click', () => excluirProduto(b.dataset.excluirProd)));
  }

  document.getElementById('busca-produtos')
    .addEventListener('input', SK.debounce(renderProdutos, 200));

  /* ==================================================================
     4. Solicitações
     ================================================================== */
  const FILTRO = {
    importacao: document.getElementById('filtro-status-imp'),
    revenda:    document.getElementById('filtro-status-rev')
  };
  Object.keys(FILTRO).forEach((k) =>
    FILTRO[k].addEventListener('change', () => carregarSolicitacoes(k)));

  async function carregarSolicitacoes(tipo) {
    const tabela = tipo === 'importacao' ? 'solicitacoes_importacao' : 'solicitacoes_revenda';
    const box = document.getElementById('lista-' + tipo);
    box.innerHTML = '<div class="loading-row"><span class="spinner spinner--dark"></span> Carregando...</div>';

    let q = sb.from(tabela).select('*').order('created_at', { ascending: false });
    const filtro = FILTRO[tipo].value;
    if (filtro) q = q.eq('status', filtro);

    const { data, error } = await q;
    if (error) { box.innerHTML = erroHtml(error); return; }

    const lista = data || [];

    // Contador de "novos" na aba
    const pill = document.getElementById('pill-' + tipo);
    if (!filtro) {
      const novos = lista.filter((s) => s.status === 'novo').length;
      pill.textContent = novos;
      pill.classList.toggle('hide', novos === 0);
    }

    if (!lista.length) {
      box.innerHTML = vazioHtml('Nenhuma solicitação por aqui',
        filtro ? 'Nenhum registro com este status.' : 'Assim que alguém enviar pelo site, aparece nesta lista.');
      return;
    }

    box.innerHTML = lista.map((s) =>
      tipo === 'importacao' ? cardImportacao(s) : cardRevenda(s)).join('');

    ligarCardsSolicitacao(box, tabela, tipo);
  }

  function cabecalhoCard(s, titulo, subtitulo) {
    return '<div class="req-head">' +
      '<div class="req-head-main">' +
        '<h4>' + SK.escapeHtml(titulo) + '</h4>' +
        '<p>' + subtitulo + '</p>' +
      '</div>' +
      '<div class="req-actions">' +
        selectStatus(s) +
        botaoWhatsApp(s) +
        '<button class="btn btn--outline btn--sm" data-detalhes>Detalhes</button>' +
      '</div>' +
    '</div>';
  }

  function selectStatus(s) {
    return '<select class="status-select status-' + SK.escapeHtml(s.status) + '" data-status="' + SK.escapeHtml(s.id) + '">' +
      Object.keys(STATUS).map((k) =>
        '<option value="' + k + '"' + (s.status === k ? ' selected' : '') + '>' +
        STATUS[k] + '</option>').join('') +
      '</select>';
  }

  function botaoWhatsApp(s) {
    const digitos = String(s.contato_telefone || '').replace(/\D/g, '');
    if (digitos.length < 10) return '';
    const numero = digitos.length <= 11 ? '55' + digitos : digitos;
    const nome = s.contato_nome || '';
    const empresa = s.empresa || s.razao_social || '';
    const msg = 'Olá, ' + nome + '! Aqui é da Skorpion. Recebemos a solicitação de ' +
                empresa + ' pelo nosso site (protocolo ' + SK.protocolo(s.id) + ').';
    return '<a class="btn btn-wa btn--sm" target="_blank" rel="noopener" href="' +
      SK.escapeHtml(SK.linkWhatsApp(msg, numero)) + '">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2zm5.43 12.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z"/></svg>' +
      'WhatsApp</a>';
  }

  function linha(rotulo, valor) {
    if (!valor) return '';
    return '<div><dt>' + SK.escapeHtml(rotulo) + '</dt><dd>' + SK.escapeHtml(valor) + '</dd></div>';
  }

  function cardImportacao(s) {
    const radar = { sim: 'Sim', nao: 'Não', nao_sei: 'Não sabe informar' }[s.possui_radar] || '—';
    const freq = {
      unica: 'Compra única', mensal: 'Mensal', trimestral: 'Trimestral',
      semestral: 'Semestral', anual: 'Anual', a_definir: 'A definir'
    }[s.frequencia] || '—';

    return '<article class="req-card" data-id="' + SK.escapeHtml(s.id) + '">' +
      cabecalhoCard(s, s.empresa,
        SK.escapeHtml(s.produto) + ' · ' + SK.formatarData(s.created_at) +
        ' · protocolo ' + SK.protocolo(s.id)) +
      '<div class="req-body"><dl class="req-grid">' +
        linha('CNPJ', s.cnpj) +
        linha('Contato', s.contato_nome) +
        linha('E-mail', s.contato_email) +
        linha('Telefone', s.contato_telefone) +
        linha('Produto', s.produto) +
        linha('País de origem', s.pais_origem) +
        linha('Volume estimado', s.volume_estimado) +
        linha('Frequência', freq) +
        linha('Possui RADAR', radar) +
      '</dl>' +
      (s.mensagem
        ? '<div style="margin-top:18px"><dt style="font-size:.72rem;font-weight:700;letter-spacing:.08em;' +
          'text-transform:uppercase;color:var(--muted-2)">Observações do cliente</dt>' +
          '<p style="margin:.3rem 0 0;white-space:pre-line">' + SK.escapeHtml(s.mensagem) + '</p></div>'
        : '') +
      notaInterna(s) +
      '</div></article>';
  }

  function cardRevenda(s) {
    const itens = Array.isArray(s.itens) ? s.itens : [];
    const total = itens.reduce((acc, i) => acc + (parseInt(i.quantidade, 10) || 0), 0);

    return '<article class="req-card" data-id="' + SK.escapeHtml(s.id) + '">' +
      cabecalhoCard(s, s.razao_social,
        itens.length + ' item(ns) · ' + total + ' unidade(s) · ' +
        SK.formatarData(s.created_at) + ' · protocolo ' + SK.protocolo(s.id)) +
      '<div class="req-body"><dl class="req-grid">' +
        linha('CNPJ', s.cnpj) +
        linha('Cidade / UF', [s.cidade, s.uf].filter(Boolean).join(' / ')) +
        linha('Contato', s.contato_nome) +
        linha('E-mail', s.contato_email) +
        linha('Telefone', s.contato_telefone) +
      '</dl>' +
      '<div style="margin-top:18px">' +
        '<dt style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-2)">Itens solicitados</dt>' +
        '<div class="table-wrap" style="margin-top:.5rem"><table class="data" style="min-width:420px">' +
          '<thead><tr><th>Produto</th><th>Unidade de venda</th><th style="width:110px">Quantidade</th></tr></thead><tbody>' +
          (itens.length
            ? itens.map((i) =>
                '<tr><td>' + SK.escapeHtml(i.nome || '—') + '</td>' +
                '<td>' + SK.escapeHtml(i.unidade_venda || '—') + '</td>' +
                '<td><strong>' + SK.escapeHtml(String(i.quantidade || 1)) + '</strong></td></tr>').join('')
            : '<tr><td colspan="3" class="muted">Nenhum item registrado.</td></tr>') +
        '</tbody></table></div>' +
      '</div>' +
      (s.observacoes
        ? '<div style="margin-top:18px"><dt style="font-size:.72rem;font-weight:700;letter-spacing:.08em;' +
          'text-transform:uppercase;color:var(--muted-2)">Observações do cliente</dt>' +
          '<p style="margin:.3rem 0 0;white-space:pre-line">' + SK.escapeHtml(s.observacoes) + '</p></div>'
        : '') +
      notaInterna(s) +
      '</div></article>';
  }

  function notaInterna(s) {
    return '<div class="field" style="margin-top:20px">' +
      '<label>Anotação interna (não aparece para o cliente)</label>' +
      '<textarea data-nota="' + SK.escapeHtml(s.id) + '" style="min-height:70px">' +
        SK.escapeHtml(s.observacoes_internas || '') + '</textarea>' +
      '<div style="margin-top:.5rem"><button class="btn btn--outline btn--sm" data-salvar-nota="' +
        SK.escapeHtml(s.id) + '">Salvar anotação</button></div>' +
    '</div>';
  }

  function ligarCardsSolicitacao(box, tabela, tipo) {
    box.querySelectorAll('[data-detalhes]').forEach((b) =>
      b.addEventListener('click', () => {
        const card = b.closest('.req-card');
        const aberto = card.classList.toggle('is-open');
        b.textContent = aberto ? 'Ocultar' : 'Detalhes';
      }));

    box.querySelectorAll('[data-status]').forEach((sel) =>
      sel.addEventListener('change', async () => {
        const id = sel.dataset.status;
        sel.className = 'status-select status-' + sel.value;
        const { error } = await sb.from(tabela).update({ status: sel.value }).eq('id', id);
        if (error) { SK.toast('Erro ao salvar status: ' + error.message, 'erro'); return; }
        SK.toast('Status atualizado para "' + STATUS[sel.value] + '".');
        if (!FILTRO[tipo].value) {
          const novos = box.querySelectorAll('[data-status]').length
            ? Array.from(box.querySelectorAll('[data-status]')).filter((x) => x.value === 'novo').length
            : 0;
          const pill = document.getElementById('pill-' + tipo);
          pill.textContent = novos;
          pill.classList.toggle('hide', novos === 0);
        }
      }));

    box.querySelectorAll('[data-salvar-nota]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.dataset.salvarNota;
        const texto = box.querySelector('[data-nota="' + id + '"]').value;
        const { error } = await sb.from(tabela)
          .update({ observacoes_internas: texto || null }).eq('id', id);
        if (error) { SK.toast('Erro ao salvar: ' + error.message, 'erro'); return; }
        SK.toast('Anotação salva.');
      }));
  }

  /* ==================================================================
     5. Modais
     ================================================================== */
  function abrirModal(id) { document.getElementById(id).classList.add('is-open'); }
  function fecharModal(el) { el.classList.remove('is-open'); }

  document.querySelectorAll('[data-fechar-modal]').forEach((b) =>
    b.addEventListener('click', () => fecharModal(b.closest('.modal-backdrop'))));

  document.querySelectorAll('.modal-backdrop').forEach((bd) =>
    bd.addEventListener('click', (e) => { if (e.target === bd) fecharModal(bd); }));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.is-open').forEach(fecharModal);
  });

  /* -------------------------- Categoria ----------------------------- */
  const formCategoria = document.getElementById('form-categoria');

  document.getElementById('btn-nova-categoria')
    .addEventListener('click', () => abrirModalCategoria(null));

  function abrirModalCategoria(id) {
    const c = id ? categorias.find((x) => x.id === id) : null;
    document.getElementById('titulo-modal-categoria').textContent =
      c ? 'Editar categoria' : 'Nova categoria';
    document.getElementById('alerta-categoria').innerHTML = '';
    document.getElementById('cat-id').value = c ? c.id : '';
    document.getElementById('cat-nome').value = c ? c.nome : '';
    document.getElementById('cat-slug').value = c ? (c.slug || '') : '';
    document.getElementById('cat-ordem').value = c ? c.ordem : 0;
    document.getElementById('cat-descricao').value = c ? (c.descricao || '') : '';
    document.getElementById('cat-ativo').checked = c ? c.ativo : true;
    abrirModal('modal-categoria');
    document.getElementById('cat-nome').focus();
  }

  formCategoria.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!SK.validarFormulario(formCategoria)) return;

    const id = document.getElementById('cat-id').value;
    const nome = document.getElementById('cat-nome').value.trim();
    const registro = {
      nome: nome,
      slug: document.getElementById('cat-slug').value.trim() || SK.slugify(nome),
      descricao: document.getElementById('cat-descricao').value.trim() || null,
      ordem: parseInt(document.getElementById('cat-ordem').value, 10) || 0,
      ativo: document.getElementById('cat-ativo').checked
    };

    const btn = document.getElementById('btn-salvar-categoria');
    SK.botaoCarregando(btn, true);
    btn.innerHTML = '<span class="spinner"></span> Salvando...';

    const { error } = id
      ? await sb.from('categorias').update(registro).eq('id', id)
      : await sb.from('categorias').insert(registro);

    SK.botaoCarregando(btn, false);
    btn.innerHTML = 'Salvar categoria';

    if (error) {
      document.getElementById('alerta-categoria').innerHTML =
        '<div class="alert alert--error">' +
        (error.code === '23505'
          ? 'Já existe uma categoria com este slug. Escolha outro.'
          : SK.escapeHtml(error.message)) + '</div>';
      return;
    }

    fecharModal(document.getElementById('modal-categoria'));
    SK.toast(id ? 'Categoria atualizada.' : 'Categoria criada.');
    await carregarCategorias();
    renderCategorias();
    renderProdutos();
  });

  async function excluirCategoria(id) {
    const c = categorias.find((x) => x.id === id);
    const usados = produtos.filter((p) => p.categoria_id === id).length;
    const aviso = usados
      ? '\n\nAtenção: ' + usados + ' produto(s) usam esta categoria e ficarão sem categoria.'
      : '';
    if (!confirm('Excluir a categoria "' + (c ? c.nome : '') + '"?' + aviso)) return;

    const { error } = await sb.from('categorias').delete().eq('id', id);
    if (error) { SK.toast('Erro ao excluir: ' + error.message, 'erro'); return; }
    SK.toast('Categoria excluída.');
    await Promise.all([carregarCategorias(), carregarProdutos()]);
    renderCategorias();
    renderProdutos();
  }

  /* --------------------------- Produto ------------------------------ */
  const formProduto = document.getElementById('form-produto');

  document.getElementById('btn-novo-produto')
    .addEventListener('click', () => abrirModalProduto(null));

  function abrirModalProduto(id) {
    const p = id ? produtos.find((x) => x.id === id) : null;
    document.getElementById('titulo-modal-produto').textContent =
      p ? 'Editar produto' : 'Novo produto';
    document.getElementById('alerta-produto').innerHTML = '';
    document.getElementById('status-upload').textContent = '';
    document.getElementById('prod-id').value = p ? p.id : '';
    document.getElementById('prod-nome').value = p ? p.nome : '';
    document.getElementById('prod-descricao').value = p ? (p.descricao || '') : '';
    document.getElementById('prod-categoria').value = p ? (p.categoria_id || '') : '';
    document.getElementById('prod-unidade').value = p ? (p.unidade_venda || '') : '';
    document.getElementById('prod-minimo').value = p ? (p.pedido_minimo || '') : '';
    document.getElementById('prod-ordem').value = p ? p.ordem : 0;
    document.getElementById('prod-ativo').checked = p ? p.ativo : true;
    document.getElementById('prod-destaque').checked = p ? p.destaque : false;

    fotosAtuais = p && Array.isArray(p.fotos) ? p.fotos.slice() : [];
    renderFotos();

    abrirModal('modal-produto');
    document.getElementById('prod-nome').focus();
  }

  formProduto.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!SK.validarFormulario(formProduto)) return;

    const id = document.getElementById('prod-id').value;
    const nome = document.getElementById('prod-nome').value.trim();
    const registro = {
      nome: nome,
      slug: SK.slugify(nome) + '-' + Math.random().toString(36).slice(2, 6),
      descricao: document.getElementById('prod-descricao').value.trim() || null,
      categoria_id: document.getElementById('prod-categoria').value || null,
      unidade_venda: document.getElementById('prod-unidade').value.trim() || null,
      pedido_minimo: document.getElementById('prod-minimo').value.trim() || null,
      ordem: parseInt(document.getElementById('prod-ordem').value, 10) || 0,
      fotos: fotosAtuais,
      ativo: document.getElementById('prod-ativo').checked,
      destaque: document.getElementById('prod-destaque').checked
    };
    // Ao editar, o slug existente é preservado (links já divulgados continuam valendo).
    if (id) delete registro.slug;

    const btn = document.getElementById('btn-salvar-produto');
    SK.botaoCarregando(btn, true);
    btn.innerHTML = '<span class="spinner"></span> Salvando...';

    const { error } = id
      ? await sb.from('produtos').update(registro).eq('id', id)
      : await sb.from('produtos').insert(registro);

    SK.botaoCarregando(btn, false);
    btn.innerHTML = 'Salvar produto';

    if (error) {
      document.getElementById('alerta-produto').innerHTML =
        '<div class="alert alert--error">' + SK.escapeHtml(error.message) + '</div>';
      return;
    }

    fecharModal(document.getElementById('modal-produto'));
    SK.toast(id ? 'Produto atualizado.' : 'Produto criado.');
    await Promise.all([carregarCategorias(), carregarProdutos()]);
    renderCategorias();
    renderProdutos();
  });

  async function excluirProduto(id) {
    const p = produtos.find((x) => x.id === id);
    if (!confirm('Excluir o produto "' + (p ? p.nome : '') + '"? Esta ação não pode ser desfeita.')) return;
    const { error } = await sb.from('produtos').delete().eq('id', id);
    if (error) { SK.toast('Erro ao excluir: ' + error.message, 'erro'); return; }
    SK.toast('Produto excluído.');
    await Promise.all([carregarCategorias(), carregarProdutos()]);
    renderCategorias();
    renderProdutos();
  }

  /* ==================================================================
     6. Fotos — compressão para 1200 px e upload no Storage
     ================================================================== */
  const areaUpload = document.getElementById('area-upload');
  const inputFotos = document.getElementById('input-fotos');
  const statusUpload = document.getElementById('status-upload');

  areaUpload.addEventListener('click', () => inputFotos.click());
  areaUpload.addEventListener('dragover', (e) => {
    e.preventDefault(); areaUpload.classList.add('is-drag');
  });
  areaUpload.addEventListener('dragleave', () => areaUpload.classList.remove('is-drag'));
  areaUpload.addEventListener('drop', (e) => {
    e.preventDefault();
    areaUpload.classList.remove('is-drag');
    processarArquivos(e.dataTransfer.files);
  });
  inputFotos.addEventListener('change', () => {
    processarArquivos(inputFotos.files);
    inputFotos.value = '';
  });

  /** Redimensiona para no máximo MAX_DIM px no maior lado e gera um JPEG. */
  function comprimir(arquivo) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(arquivo);
      const img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        let { width: w, height: h } = img;
        if (w > MAX_DIM || h > MAX_DIM) {
          const escala = MAX_DIM / Math.max(w, h);
          w = Math.round(w * escala);
          h = Math.round(h * escala);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';          // evita fundo preto em PNG transparente
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Falha ao comprimir a imagem.')),
          'image/jpeg', QUALIDADE
        );
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Arquivo de imagem inválido.')); };
      img.src = url;
    });
  }

  async function processarArquivos(arquivos) {
    const lista = Array.from(arquivos || []).filter((f) => f.type.startsWith('image/'));
    if (!lista.length) return;

    let enviadas = 0;
    for (let i = 0; i < lista.length; i++) {
      statusUpload.innerHTML =
        '<span class="spinner spinner--dark" style="display:inline-block;vertical-align:-3px"></span> ' +
        'Enviando ' + (i + 1) + ' de ' + lista.length + '...';
      try {
        const blob = await comprimir(lista[i]);
        const nomeArquivo = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';

        const { error: erroUpload } = await sb.storage
          .from(BUCKET)
          .upload(nomeArquivo, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });

        if (erroUpload) throw erroUpload;

        const { data } = sb.storage.from(BUCKET).getPublicUrl(nomeArquivo);
        fotosAtuais.push(data.publicUrl);
        enviadas++;
        renderFotos();
      } catch (err) {
        console.error(err);
        statusUpload.innerHTML =
          '<span style="color:var(--danger)">Erro em "' + SK.escapeHtml(lista[i].name) + '": ' +
          SK.escapeHtml(err.message || 'falha no upload') +
          '. Confira se o bucket "' + BUCKET + '" existe (está no supabase-schema.sql).</span>';
        return;
      }
    }

    statusUpload.innerHTML =
      '<span style="color:var(--success)">' + enviadas + ' foto(s) enviada(s). ' +
      'Lembre de salvar o produto.</span>';
  }

  function renderFotos() {
    const grade = document.getElementById('grade-fotos');
    grade.innerHTML = fotosAtuais.map((url, i) =>
      '<div class="photo-item">' +
        '<img src="' + SK.escapeHtml(url) + '" alt="">' +
        '<button type="button" data-remover-foto="' + i + '" aria-label="Remover foto">×</button>' +
        (i === 0 ? '<span class="main-tag">Capa</span>' : '') +
      '</div>').join('');

    grade.querySelectorAll('[data-remover-foto]').forEach((b) =>
      b.addEventListener('click', () => {
        fotosAtuais.splice(parseInt(b.dataset.removerFoto, 10), 1);
        renderFotos();
      }));
  }

  /* ==================================================================
     7. Auxiliares de HTML
     ================================================================== */
  function erroHtml(error) {
    return '<div class="alert alert--error"><strong>Erro ao carregar.</strong> ' +
      SK.escapeHtml(error.message || '') +
      '<br>Verifique se o SQL de <code>supabase-schema.sql</code> foi executado.</div>';
  }

  function vazioHtml(titulo, texto) {
    return '<div class="empty-state" style="background:#fff;border:1px solid var(--line);border-radius:var(--radius-lg)">' +
      '<h3>' + SK.escapeHtml(titulo) + '</h3>' +
      '<p>' + SK.escapeHtml(texto) + '</p></div>';
  }

  iniciar();
})();
