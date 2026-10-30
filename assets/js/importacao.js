/* =====================================================================
   SKORPION — importacao.html
   Cena 3D reduzida + envio do formulário de cotação de importação.
   ===================================================================== */

(function () {
  'use strict';

  /* ----------------------------- Cena 3D ---------------------------- */
  window.addEventListener('load', function () {
    if (window.SkorpionHero3D) {
      SkorpionHero3D.iniciar(document.getElementById('hero3d'), { modo: 'mini' });
    }
  });

  /* --------------------------- Formulário --------------------------- */
  const form = document.getElementById('form-importacao');
  if (!form) return;

  const alerta = document.getElementById('form-alerta');
  const btn = document.getElementById('btn-enviar');
  const blocoForm = document.getElementById('bloco-form');
  const blocoSucesso = document.getElementById('bloco-sucesso');

  SK.ligarCampoCNPJ(document.getElementById('cnpj'));
  SK.ligarCampoTelefone(document.getElementById('contato_telefone'));

  function mostrarErro(mensagem) {
    alerta.innerHTML = '<div class="alert alert--error">' + SK.escapeHtml(mensagem) + '</div>';
    alerta.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    alerta.innerHTML = '';

    if (!SK.validarFormulario(form)) {
      mostrarErro('Confira os campos destacados antes de enviar.');
      return;
    }

    const sb = SK.db();
    if (!sb) {
      SK.avisoConfig(alerta);
      alerta.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const radar = form.querySelector('input[name="possui_radar"]:checked');
    const id = SK.novoId();

    const registro = {
      id:               id,
      empresa:          form.empresa.value.trim(),
      cnpj:             form.cnpj.value.trim(),
      contato_nome:     form.contato_nome.value.trim(),
      contato_email:    form.contato_email.value.trim(),
      contato_telefone: form.contato_telefone.value.trim(),
      produto:          form.produto.value.trim(),
      pais_origem:      form.pais_origem.value.trim() || null,
      volume_estimado:  form.volume_estimado.value.trim() || null,
      frequencia:       form.frequencia.value || null,
      possui_radar:     radar ? radar.value : null,
      mensagem:         form.mensagem.value.trim() || null,
      origem:           'site/importacao'
    };

    SK.botaoCarregando(btn, true);

    try {
      // Sem .select(): a RLS não concede leitura pública das solicitações.
      const { error } = await sb.from('solicitacoes_importacao').insert(registro);
      if (error) throw error;

      document.getElementById('protocolo').textContent = SK.protocolo(id);
      blocoForm.classList.add('hide');
      blocoSucesso.classList.remove('hide');
      blocoSucesso.classList.add('is-visible');
      SK.renderEmpresa(blocoSucesso);
      blocoSucesso.scrollIntoView({ block: 'center', behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      SK.botaoCarregando(btn, false);
      mostrarErro(
        'Não conseguimos registrar a solicitação agora (' +
        (err.message || 'erro desconhecido') +
        '). Tente novamente em instantes ou fale com a gente pelo WhatsApp.'
      );
    }
  });
})();
