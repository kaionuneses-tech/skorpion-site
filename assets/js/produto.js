/* =====================================================================
   SKORPION — produto.html?id=...
   Ficha do produto, galeria e botão de adicionar à cotação.
   ===================================================================== */

(function () {
  'use strict';

  const alvo = document.getElementById('conteudo').querySelector('.container');
  const id = SK.param('id');

  if (!id) {
    erro('Produto não informado.', 'O endereço precisa conter o identificador do produto.');
    return;
  }

  function erro(titulo, texto) {
    alvo.innerHTML =
      '<div class="empty-state">' +
        '<div class="icon-box icon-box--navy">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        '</div>' +
        '<h3>' + SK.escapeHtml(titulo) + '</h3>' +
        '<p>' + SK.escapeHtml(texto) + '</p>' +
        '<a class="btn btn--primary" href="produtos.html">Voltar ao catálogo</a>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ */
  async function carregar() {
    const sb = SK.db();
    if (!sb) { SK.avisoConfig(alvo); return; }

    try {
      const { data: p, error } = await sb
        .from('produtos')
        .select('id, nome, descricao, categoria_id, unidade_venda, pedido_minimo, fotos, destaque')
        .eq('id', id)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      if (!p) {
        erro('Produto não encontrado', 'Ele pode ter saído do catálogo ou estar temporariamente inativo.');
        return;
      }

      let categoria = null;
      if (p.categoria_id) {
        const { data: c } = await sb
          .from('categorias').select('id, nome').eq('id', p.categoria_id).maybeSingle();
        categoria = c || null;
      }

      render(p, categoria);
      carregarRelacionados(sb, p);
    } catch (err) {
      console.error(err);
      erro('Não foi possível carregar o produto', err.message || 'Tente novamente em instantes.');
    }
  }

  /* ------------------------------ Render ----------------------------- */
  function render(p, categoria) {
    document.title = p.nome + ' | Skorpion';
    const fotos = Array.isArray(p.fotos) ? p.fotos.filter(Boolean) : [];
    const noCarrinho = SK.carrinho.contemProduto(p.id);

    alvo.innerHTML = '' +
      '<nav class="breadcrumb" style="color:var(--muted)">' +
        '<a href="index.html">Início</a><span>/</span>' +
        '<a href="produtos.html">Produtos</a><span>/</span>' +
        (categoria
          ? '<a href="produtos.html?categoria=' + encodeURIComponent(categoria.id) + '">' +
            SK.escapeHtml(categoria.nome) + '</a><span>/</span>'
          : '') +
        SK.escapeHtml(p.nome) +
      '</nav>' +

      '<div class="product-detail" style="margin-top:24px">' +
        '<div>' +
          '<div class="gallery-main" id="galeria-principal">' +
            (fotos.length
              ? '<img src="' + SK.escapeHtml(fotos[0]) + '" alt="' + SK.escapeHtml(p.nome) + '">'
              : SK.SEM_FOTO) +
          '</div>' +
          (fotos.length > 1
            ? '<div class="gallery-thumbs" id="galeria-thumbs">' +
                fotos.map((f, i) =>
                  '<button class="' + (i === 0 ? 'is-active' : '') + '" data-foto="' + SK.escapeHtml(f) + '" ' +
                  'aria-label="Foto ' + (i + 1) + '"><img src="' + SK.escapeHtml(f) + '" alt=""></button>'
                ).join('') +
              '</div>'
            : '') +
        '</div>' +

        '<div>' +
          (p.destaque ? '<span class="tag tag--amber">Destaque</span> ' : '') +
          (categoria ? '<span class="tag tag--blue">' + SK.escapeHtml(categoria.nome) + '</span>' : '') +
          '<h1 style="font-size:clamp(1.7rem,3vw,2.35rem);margin:1rem 0 .8rem">' +
            SK.escapeHtml(p.nome) + '</h1>' +
          (p.descricao
            ? '<p class="lead" style="white-space:pre-line">' + SK.escapeHtml(p.descricao) + '</p>'
            : '<p class="muted">Sem descrição cadastrada para este item.</p>') +

          '<dl class="spec-list">' +
            (p.unidade_venda
              ? '<div><dt>Unidade de venda</dt><dd>' + SK.escapeHtml(p.unidade_venda) + '</dd></div>' : '') +
            (p.pedido_minimo
              ? '<div><dt>Pedido mínimo</dt><dd>' + SK.escapeHtml(p.pedido_minimo) + '</dd></div>' : '') +
            '<div><dt>Preço</dt><dd>Sob cotação</dd></div>' +
            '<div><dt>Público</dt><dd>Exclusivo para empresas (CNPJ)</dd></div>' +
          '</dl>' +

          '<div class="card" style="margin-top:1.8rem;padding:22px">' +
            '<label class="small" style="font-weight:600;color:var(--ink);display:block;margin-bottom:.6rem">' +
              'Quantidade desejada</label>' +
            '<div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center">' +
              '<div class="qty-control">' +
                '<button type="button" id="qtd-menos" aria-label="Diminuir">−</button>' +
                '<input type="number" id="qtd" value="1" min="1" step="1" aria-label="Quantidade">' +
                '<button type="button" id="qtd-mais" aria-label="Aumentar">+</button>' +
              '</div>' +
              '<button class="btn ' + (noCarrinho ? 'btn--green' : 'btn--amber') + ' btn--lg" id="btn-add" ' +
                'style="flex:1;min-width:210px">' +
                (noCarrinho ? 'Já está na cotação — ver lista' : 'Adicionar à cotação') +
              '</button>' +
            '</div>' +
            '<p class="tiny muted" style="margin:.9rem 0 0">' +
              'Adicionar à cotação não gera pedido nem compromisso. Você confecciona a ' +
              'lista e envia os dados da sua empresa na etapa final.' +
            '</p>' +
          '</div>' +

          '<div class="btn-row" style="margin-top:1.4rem">' +
            '<a class="btn btn--outline" href="produtos.html">Continuar navegando</a>' +
            '<a class="btn btn--outline btn-wa" data-emp-link="whatsapp" ' +
              'data-wa-msg="Olá! Tenho interesse no produto: ' + SK.escapeHtml(p.nome) + '" href="#">' +
              'Tirar uma dúvida</a>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div id="relacionados"></div>';

    SK.renderEmpresa(alvo);
    ligarGaleria();
    ligarQuantidade(p);
  }

  function ligarGaleria() {
    const thumbs = document.getElementById('galeria-thumbs');
    if (!thumbs) return;
    const principal = document.getElementById('galeria-principal');
    thumbs.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        thumbs.querySelectorAll('button').forEach((x) => x.classList.remove('is-active'));
        b.classList.add('is-active');
        principal.innerHTML = '<img src="' + SK.escapeHtml(b.dataset.foto) + '" alt="">';
      });
    });
  }

  function ligarQuantidade(p) {
    const input = document.getElementById('qtd');
    const btnAdd = document.getElementById('btn-add');

    document.getElementById('qtd-menos').addEventListener('click', () => {
      input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
    });
    document.getElementById('qtd-mais').addEventListener('click', () => {
      input.value = (parseInt(input.value, 10) || 1) + 1;
    });
    input.addEventListener('change', () => {
      input.value = Math.max(1, parseInt(input.value, 10) || 1);
    });

    btnAdd.addEventListener('click', () => {
      if (SK.carrinho.contemProduto(p.id)) { location.href = 'cotacao.html'; return; }
      SK.carrinho.adicionar(p, parseInt(input.value, 10) || 1);
      btnAdd.className = 'btn btn--green btn--lg';
      btnAdd.style.flex = '1';
      btnAdd.style.minWidth = '210px';
      btnAdd.textContent = 'Já está na cotação — ver lista';
      SK.toast(p.nome + ' foi adicionado à sua cotação.');
    });
  }

  /* --------------------------- Relacionados -------------------------- */
  async function carregarRelacionados(sb, p) {
    if (!p.categoria_id) return;
    const box = document.getElementById('relacionados');

    const { data, error } = await sb
      .from('produtos')
      .select('id, nome, unidade_venda, pedido_minimo, fotos, destaque')
      .eq('ativo', true)
      .eq('categoria_id', p.categoria_id)
      .neq('id', p.id)
      .limit(4);

    if (error || !data || !data.length) return;

    box.innerHTML =
      '<div style="margin-top:clamp(48px,6vw,80px)">' +
        '<h2>Outros itens da mesma categoria</h2>' +
        '<div class="product-grid" style="margin-top:24px">' +
          data.map((r) => {
            const foto = Array.isArray(r.fotos) && r.fotos.length ? r.fotos[0] : null;
            return '<article class="product-card">' +
              '<a class="product-thumb" href="produto.html?id=' + encodeURIComponent(r.id) + '">' +
                (r.destaque ? '<span class="badge-destaque">Destaque</span>' : '') +
                (foto ? '<img src="' + SK.escapeHtml(foto) + '" alt="' + SK.escapeHtml(r.nome) + '" loading="lazy">' : SK.SEM_FOTO) +
              '</a>' +
              '<div class="product-body">' +
                '<h3 class="product-name"><a href="produto.html?id=' + encodeURIComponent(r.id) + '">' +
                  SK.escapeHtml(r.nome) + '</a></h3>' +
                '<div class="product-meta">' +
                  (r.unidade_venda ? '<span>' + SK.escapeHtml(r.unidade_venda) + '</span>' : '') +
                '</div>' +
                '<div class="product-actions">' +
                  '<a class="btn btn--outline btn--sm" href="produto.html?id=' + encodeURIComponent(r.id) + '">Ver detalhes</a>' +
                '</div>' +
              '</div>' +
            '</article>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  carregar();
})();
