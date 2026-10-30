/* =====================================================================
   SKORPION — cotacao.html
   Lista de produtos (localStorage) + dados da empresa → solicitacoes_revenda.
   ===================================================================== */

(function () {
  'use strict';

  const blocoVazio   = document.getElementById('bloco-vazio');
  const blocoCotacao = document.getElementById('bloco-cotacao');
  const blocoSucesso = document.getElementById('bloco-sucesso');
  const lista        = document.getElementById('lista-itens');
  const titulo       = document.getElementById('titulo-itens');
  const alerta       = document.getElementById('form-alerta');
  const form         = document.getElementById('form-revenda');
  const btn          = document.getElementById('btn-enviar');

  SK.ligarCampoCNPJ(document.getElementById('cnpj'));
  SK.ligarCampoTelefone(document.getElementById('contato_telefone'));

  /* ------------------------------ Lista ------------------------------ */
  function render() {
    const itens = SK.carrinho.listar();

    if (!itens.length) {
      blocoVazio.classList.remove('hide');
      blocoCotacao.classList.add('hide');
      return;
    }

    blocoVazio.classList.add('hide');
    blocoCotacao.classList.remove('hide');

    titulo.textContent = itens.length === 1
      ? 'Produto selecionado'
      : itens.length + ' produtos selecionados';

    lista.innerHTML = itens.map((i) =>
      '<div class="cart-item" data-id="' + SK.escapeHtml(i.produto_id) + '">' +
        '<div class="cart-item-thumb">' +
          (i.foto
            ? '<img src="' + SK.escapeHtml(i.foto) + '" alt="">'
            : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8497a8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>') +
        '</div>' +
        '<div class="cart-item-info">' +
          '<h4><a href="produto.html?id=' + encodeURIComponent(i.produto_id) + '" style="color:inherit">' +
            SK.escapeHtml(i.nome) + '</a></h4>' +
          '<p>' +
            (i.unidade_venda ? 'Unidade: ' + SK.escapeHtml(i.unidade_venda) : 'Unidade não informada') +
            (i.pedido_minimo ? ' · Mínimo: ' + SK.escapeHtml(i.pedido_minimo) : '') +
          '</p>' +
        '</div>' +
        '<div class="cart-item-side">' +
          '<div class="qty-control">' +
            '<button type="button" data-menos aria-label="Diminuir">−</button>' +
            '<input type="number" min="1" step="1" value="' + (parseInt(i.quantidade, 10) || 1) + '" ' +
              'aria-label="Quantidade de ' + SK.escapeHtml(i.nome) + '">' +
            '<button type="button" data-mais aria-label="Aumentar">+</button>' +
          '</div>' +
          '<button class="icon-btn" data-remover aria-label="Remover ' + SK.escapeHtml(i.nome) + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>'
    ).join('');

    lista.querySelectorAll('.cart-item').forEach((linha) => {
      const id = linha.dataset.id;
      const input = linha.querySelector('input[type="number"]');

      const aplicar = (valor) => {
        const q = Math.max(1, parseInt(valor, 10) || 1);
        input.value = q;
        SK.carrinho.definirQuantidade(id, q);
      };

      linha.querySelector('[data-menos]').addEventListener('click',
        () => aplicar((parseInt(input.value, 10) || 1) - 1));
      linha.querySelector('[data-mais]').addEventListener('click',
        () => aplicar((parseInt(input.value, 10) || 1) + 1));
      input.addEventListener('change', () => aplicar(input.value));

      linha.querySelector('[data-remover]').addEventListener('click', () => {
        SK.carrinho.remover(id);
        render();
        SK.toast('Produto removido da cotação.');
      });
    });
  }

  document.getElementById('btn-limpar').addEventListener('click', () => {
    if (!confirm('Remover todos os produtos da sua lista de cotação?')) return;
    SK.carrinho.limpar();
    render();
  });

  /* ---------------------------- Envio -------------------------------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    alerta.innerHTML = '';

    const itens = SK.carrinho.listar();
    if (!itens.length) {
      alerta.innerHTML = '<div class="alert alert--error">Sua lista está vazia.</div>';
      return;
    }

    if (!SK.validarFormulario(form)) {
      alerta.innerHTML = '<div class="alert alert--error">Confira os campos destacados antes de enviar.</div>';
      return;
    }

    const sb = SK.db();
    if (!sb) { SK.avisoConfig(alerta); return; }

    const id = SK.novoId();
    const registro = {
      id:               id,
      razao_social:     form.razao_social.value.trim(),
      cnpj:             form.cnpj.value.trim(),
      cidade:           form.cidade.value.trim(),
      uf:               form.uf.value,
      contato_nome:     form.contato_nome.value.trim(),
      contato_email:    form.contato_email.value.trim(),
      contato_telefone: form.contato_telefone.value.trim(),
      observacoes:      form.observacoes.value.trim() || null,
      itens: itens.map((i) => ({
        produto_id:    i.produto_id,
        nome:          i.nome,
        unidade_venda: i.unidade_venda || null,
        pedido_minimo: i.pedido_minimo || null,
        quantidade:    parseInt(i.quantidade, 10) || 1
      })),
      origem: 'site/cotacao'
    };

    SK.botaoCarregando(btn, true);

    try {
      // Sem .select(): a RLS não concede leitura pública das solicitações.
      const { error } = await sb.from('solicitacoes_revenda').insert(registro);
      if (error) throw error;

      SK.carrinho.limpar();                       // some com a lista, como combinado
      document.getElementById('protocolo').textContent = SK.protocolo(id);
      blocoCotacao.classList.add('hide');
      blocoVazio.classList.add('hide');
      blocoSucesso.classList.remove('hide');
      SK.renderEmpresa(blocoSucesso);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      SK.botaoCarregando(btn, false);
      alerta.innerHTML =
        '<div class="alert alert--error">Não conseguimos registrar a cotação agora (' +
        SK.escapeHtml(err.message || 'erro desconhecido') +
        '). Sua lista foi mantida — tente novamente em instantes.</div>';
    }
  });

  render();
})();
