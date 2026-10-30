/* =====================================================================
   SKORPION — produtos.html
   Catálogo com filtro por categoria e busca. Sem preço: tudo por cotação.
   ===================================================================== */

(function () {
  'use strict';

  const grade = document.getElementById('grade-produtos');
  const chips = document.getElementById('chips-categorias');
  const busca = document.getElementById('busca');
  const resumo = document.getElementById('resumo-resultados');
  const vazio = document.getElementById('estado-vazio');

  let produtos = [];
  let categorias = [];
  let filtroCategoria = SK.param('categoria') || '';
  let termoBusca = '';

  /* ------------------------------------------------------------------ */
  async function carregar() {
    const sb = SK.db();
    if (!sb) {
      grade.innerHTML = '';
      SK.avisoConfig(vazio);
      return;
    }

    try {
      const [resCat, resProd] = await Promise.all([
        sb.from('categorias')
          .select('id, nome, slug, ordem')
          .eq('ativo', true)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        sb.from('produtos')
          .select('id, nome, slug, descricao, categoria_id, unidade_venda, pedido_minimo, fotos, destaque, ordem')
          .eq('ativo', true)
          .order('destaque', { ascending: false })
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true })
      ]);

      if (resCat.error) throw resCat.error;
      if (resProd.error) throw resProd.error;

      categorias = resCat.data || [];
      produtos = resProd.data || [];

      renderChips();
      renderGrade();
    } catch (err) {
      console.error(err);
      grade.innerHTML = '';
      vazio.innerHTML =
        '<div class="alert alert--error"><strong>Não foi possível carregar o catálogo.</strong> ' +
        SK.escapeHtml(err.message || '') +
        '<br>Confira se o SQL de <code>supabase-schema.sql</code> foi executado e se as ' +
        'políticas de RLS estão ativas.</div>';
    }
  }

  /* ------------------------------ Filtros ---------------------------- */
  function renderChips() {
    const todas = '<button class="chip" data-cat="">Todas as categorias</button>';
    const lista = categorias.map((c) =>
      '<button class="chip" data-cat="' + SK.escapeHtml(c.id) + '">' +
      SK.escapeHtml(c.nome) + '</button>'
    ).join('');
    chips.innerHTML = todas + lista;

    chips.querySelectorAll('.chip').forEach((b) => {
      if (b.dataset.cat === filtroCategoria) b.classList.add('is-active');
      b.addEventListener('click', () => {
        filtroCategoria = b.dataset.cat;
        chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        atualizarUrl();
        renderGrade();
      });
    });
  }

  function atualizarUrl() {
    const url = new URL(location.href);
    if (filtroCategoria) url.searchParams.set('categoria', filtroCategoria);
    else url.searchParams.delete('categoria');
    history.replaceState(null, '', url);
  }

  function nomeCategoria(id) {
    const c = categorias.find((x) => x.id === id);
    return c ? c.nome : '';
  }

  function filtrar() {
    const termo = termoBusca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (filtroCategoria && p.categoria_id !== filtroCategoria) return false;
      if (!termo) return true;
      const alvo = (p.nome + ' ' + (p.descricao || '') + ' ' + nomeCategoria(p.categoria_id)).toLowerCase();
      return alvo.includes(termo);
    });
  }

  /* ------------------------------ Grade ------------------------------ */
  function cardProduto(p) {
    const foto = Array.isArray(p.fotos) && p.fotos.length ? p.fotos[0] : null;
    const cat = nomeCategoria(p.categoria_id);
    const noCarrinho = SK.carrinho.contemProduto(p.id);

    return '' +
      '<article class="product-card">' +
        '<a class="product-thumb" href="produto.html?id=' + encodeURIComponent(p.id) + '">' +
          (p.destaque ? '<span class="badge-destaque">Destaque</span>' : '') +
          (foto
            ? '<img src="' + SK.escapeHtml(foto) + '" alt="' + SK.escapeHtml(p.nome) + '" loading="lazy">'
            : SK.SEM_FOTO) +
        '</a>' +
        '<div class="product-body">' +
          (cat ? '<div class="product-cat">' + SK.escapeHtml(cat) + '</div>' : '') +
          '<h3 class="product-name"><a href="produto.html?id=' + encodeURIComponent(p.id) + '">' +
            SK.escapeHtml(p.nome) + '</a></h3>' +
          '<div class="product-meta">' +
            (p.unidade_venda ? '<span>Unidade de venda: <strong>' + SK.escapeHtml(p.unidade_venda) + '</strong></span>' : '') +
            (p.pedido_minimo ? '<span>Pedido mínimo: <strong>' + SK.escapeHtml(p.pedido_minimo) + '</strong></span>' : '') +
          '</div>' +
          '<div class="product-actions">' +
            '<button class="btn ' + (noCarrinho ? 'btn--green' : 'btn--primary') + ' btn--sm" ' +
              'data-add="' + SK.escapeHtml(p.id) + '">' +
              (noCarrinho ? 'Na cotação' : 'Adicionar à cotação') +
            '</button>' +
            '<a class="btn btn--outline btn--sm" href="produto.html?id=' + encodeURIComponent(p.id) + '">Detalhes</a>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  function renderGrade() {
    const lista = filtrar();
    vazio.innerHTML = '';

    if (!produtos.length) {
      grade.innerHTML = '';
      vazio.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon-box icon-box--navy">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>' +
          '</div>' +
          '<h3>Catálogo ainda sem produtos publicados</h3>' +
          '<p>Cadastre os primeiros itens na <a href="admin.html">área restrita</a>, ' +
          'ou fale com a gente para avaliar uma importação sob demanda.</p>' +
          '<a class="btn btn--primary" href="importacao.html#cotacao">Solicitar importação</a>' +
        '</div>';
      resumo.textContent = '';
      return;
    }

    if (!lista.length) {
      grade.innerHTML = '';
      vazio.innerHTML =
        '<div class="empty-state">' +
          '<div class="icon-box icon-box--navy">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>' +
          '</div>' +
          '<h3>Nenhum produto encontrado</h3>' +
          '<p>Tente outro termo de busca ou remova o filtro de categoria.</p>' +
          '<button class="btn btn--outline" id="limpar-filtros">Limpar filtros</button>' +
        '</div>';
      const btn = document.getElementById('limpar-filtros');
      if (btn) btn.addEventListener('click', () => {
        filtroCategoria = ''; termoBusca = ''; busca.value = '';
        chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('is-active'));
        chips.querySelector('.chip[data-cat=""]').classList.add('is-active');
        atualizarUrl();
        renderGrade();
      });
      resumo.textContent = '0 produtos encontrados.';
      return;
    }

    grade.innerHTML = lista.map(cardProduto).join('');
    resumo.textContent = lista.length === 1
      ? '1 produto encontrado.'
      : lista.length + ' produtos encontrados.';

    grade.querySelectorAll('[data-add]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = produtos.find((x) => x.id === btn.dataset.add);
        if (!p) return;
        if (SK.carrinho.contemProduto(p.id)) {
          location.href = 'cotacao.html';
          return;
        }
        SK.carrinho.adicionar(p, 1);
        btn.className = 'btn btn--green btn--sm';
        btn.textContent = 'Na cotação';
        SK.toast(p.nome + ' foi adicionado à sua cotação.');
      });
    });
  }

  /* ------------------------------ Eventos ---------------------------- */
  if (busca) {
    busca.addEventListener('input', SK.debounce(() => {
      termoBusca = busca.value;
      renderGrade();
    }, 220));
  }

  // Carrinho alterado em outra aba: só os botões precisam refletir o estado.
  window.addEventListener('storage', () => {
    grade.querySelectorAll('[data-add]').forEach((btn) => {
      const dentro = SK.carrinho.contemProduto(btn.dataset.add);
      btn.className = 'btn ' + (dentro ? 'btn--green' : 'btn--primary') + ' btn--sm';
      btn.textContent = dentro ? 'Na cotação' : 'Adicionar à cotação';
    });
  });

  carregar();
})();
