/* =====================================================================
   SKORPION — Camada comum a todas as páginas
   Depende de: config.js + supabase-js (UMD, via CDN)
   ===================================================================== */

const SK = (function () {
  'use strict';

  /* ------------------------------------------------------------------
     Supabase
     ------------------------------------------------------------------ */
  let _client = null;

  function configurado() {
    const c = SKORPION.supabase;
    return !!c.url && !!c.anonKey &&
           !c.url.includes('SEU-PROJETO') &&
           !c.anonKey.includes('SUA_CHAVE');
  }

  function db() {
    if (_client) return _client;
    if (!configurado()) return null;
    if (typeof window.supabase === 'undefined') {
      console.error('[Skorpion] supabase-js não carregou (verifique a conexão / CDN).');
      return null;
    }
    _client = window.supabase.createClient(
      SKORPION.supabase.url,
      SKORPION.supabase.anonKey,
      { auth: { persistSession: true, autoRefreshToken: true } }
    );
    return _client;
  }

  /** Mensagem padronizada quando o Supabase ainda não foi configurado. */
  function avisoConfig(container) {
    if (!container) return;
    container.innerHTML =
      '<div class="alert alert--warn">' +
      '<strong>Supabase ainda não configurado.</strong> Abra ' +
      '<code>assets/js/config.js</code> e preencha <code>supabase.url</code> e ' +
      '<code>supabase.anonKey</code>. O SQL das tabelas está em ' +
      '<code>supabase-schema.sql</code>.</div>';
  }

  /* ------------------------------------------------------------------
     Placeholders da empresa
     Uso no HTML: <span data-emp="telefone"></span>
     ------------------------------------------------------------------ */
  const ehPlaceholder = (v) => typeof v === 'string' && /^\[.*\]$/.test(v.trim());

  function valorEmpresa(chave) {
    return SKORPION.empresa[chave] ?? '';
  }

  function pintaPlaceholder(el, valor) {
    if (ehPlaceholder(valor)) {
      el.innerHTML = '<span class="ph" title="Preencha em assets/js/config.js">' +
                     escapeHtml(valor) + '</span>';
    } else {
      el.textContent = valor;
    }
  }

  function renderEmpresa(raiz) {
    const root = raiz || document;

    root.querySelectorAll('[data-emp]').forEach((el) => {
      pintaPlaceholder(el, valorEmpresa(el.dataset.emp));
    });

    // Links de e-mail
    root.querySelectorAll('[data-emp-link="email"]').forEach((el) => {
      const mail = valorEmpresa('email');
      el.href = ehPlaceholder(mail) ? '#' : 'mailto:' + mail;
    });

    // Links de telefone
    root.querySelectorAll('[data-emp-link="tel"]').forEach((el) => {
      const tel = valorEmpresa('telefone');
      el.href = ehPlaceholder(tel) ? '#' : 'tel:' + tel.replace(/\D/g, '');
    });

    // Links de WhatsApp
    root.querySelectorAll('[data-emp-link="whatsapp"]').forEach((el) => {
      el.href = linkWhatsApp(el.dataset.waMsg || '');
      el.target = '_blank';
      el.rel = 'noopener';
    });

    // Redes sociais: escondem-se quando vazias
    root.querySelectorAll('[data-emp-social]').forEach((el) => {
      const url = valorEmpresa(el.dataset.empSocial);
      if (url) { el.href = url; } else { el.classList.add('hide'); }
    });
  }

  function linkWhatsApp(mensagem, numeroOverride) {
    const bruto = numeroOverride || valorEmpresa('whatsapp');
    const num = String(bruto).replace(/\D/g, '');
    if (!num || num.length < 10) return '#';
    const base = 'https://wa.me/' + num;
    return mensagem ? base + '?text=' + encodeURIComponent(mensagem) : base;
  }

  /* Números da home ------------------------------------------------- */
  function renderNumeros(alvo) {
    const el = typeof alvo === 'string' ? document.querySelector(alvo) : alvo;
    if (!el) return;
    el.innerHTML = SKORPION.numeros.map((n) => {
      const v = ehPlaceholder(n.valor)
        ? '<span class="ph" title="Preencha em assets/js/config.js">' + escapeHtml(n.valor) + '</span>'
        : escapeHtml(n.valor);
      return '<div class="stat">' +
               '<div class="stat-value">' + v +
                 (n.sufixo ? '<span class="suffix">' + escapeHtml(n.sufixo) + '</span>' : '') +
               '</div>' +
               '<div class="stat-label">' + escapeHtml(n.rotulo) + '</div>' +
             '</div>';
    }).join('');
  }

  /* ------------------------------------------------------------------
     Validação / máscaras
     ------------------------------------------------------------------ */

  /** Valida CNPJ pelos dois dígitos verificadores (módulo 11). */
  function validarCNPJ(valor) {
    const c = String(valor || '').replace(/\D/g, '');
    if (c.length !== 14) return false;
    if (/^(\d)\1{13}$/.test(c)) return false;          // 00000000000000, 11111111111111, ...

    const calcula = (base) => {
      let peso = base.length - 7;
      let soma = 0;
      for (let i = 0; i < base.length; i++) {
        soma += Number(base[i]) * peso;
        peso = (peso - 1 < 2) ? 9 : peso - 1;
      }
      const resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };

    const dv1 = calcula(c.slice(0, 12));
    if (dv1 !== Number(c[12])) return false;
    const dv2 = calcula(c.slice(0, 13));
    return dv2 === Number(c[13]);
  }

  function mascaraCNPJ(v) {
    return String(v || '').replace(/\D/g, '').slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function mascaraTelefone(v) {
    const d = String(v || '').replace(/\D/g, '').slice(0, 11);
    if (d.length <= 10) {
      return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return d.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
  }

  /** Liga máscara + validação de CNPJ a um <input>. */
  function ligarCampoCNPJ(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'numeric');
    input.setAttribute('maxlength', '18');
    input.addEventListener('input', () => {
      const pos = input.selectionStart === input.value.length;
      input.value = mascaraCNPJ(input.value);
      if (pos) input.setSelectionRange(input.value.length, input.value.length);
      limparErro(input);
    });
    input.addEventListener('blur', () => {
      const bruto = input.value.replace(/\D/g, '');
      if (!bruto) return;
      if (!validarCNPJ(bruto)) {
        marcarErro(input, 'CNPJ inválido — confira os dígitos.');
      } else {
        limparErro(input);
        input.closest('.field')?.classList.add('is-valid');
      }
    });
  }

  function ligarCampoTelefone(input) {
    if (!input) return;
    input.setAttribute('inputmode', 'tel');
    input.addEventListener('input', () => {
      input.value = mascaraTelefone(input.value);
      limparErro(input);
    });
  }

  function marcarErro(input, msg) {
    const field = input.closest('.field');
    if (!field) return;
    field.classList.add('has-error');
    field.classList.remove('is-valid');
    let span = field.querySelector('.error-msg');
    if (!span) {
      span = document.createElement('span');
      span.className = 'error-msg';
      field.appendChild(span);
    }
    span.textContent = msg;
  }

  function limparErro(input) {
    input.closest('.field')?.classList.remove('has-error');
  }

  /**
   * Validação genérica de formulário.
   * Campos com [required] não podem ficar vazios; type=email precisa ser válido;
   * qualquer input com data-cnpj passa pelos dígitos verificadores.
   * Retorna true/false e foca o primeiro problema.
   */
  function validarFormulario(form) {
    let ok = true;
    let primeiro = null;

    form.querySelectorAll('input, select, textarea').forEach((el) => {
      if (el.type === 'hidden' || el.disabled) return;
      limparErro(el);

      const valor = (el.value || '').trim();

      if (el.hasAttribute('required')) {
        if (el.type === 'checkbox' && !el.checked) {
          marcarErro(el, 'Campo obrigatório.'); ok = false; primeiro = primeiro || el; return;
        }
        if (el.type !== 'checkbox' && !valor) {
          marcarErro(el, 'Campo obrigatório.'); ok = false; primeiro = primeiro || el; return;
        }
      }
      if (el.type === 'email' && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor)) {
        marcarErro(el, 'E-mail inválido.'); ok = false; primeiro = primeiro || el; return;
      }
      if (el.dataset.cnpj !== undefined && valor && !validarCNPJ(valor)) {
        marcarErro(el, 'CNPJ inválido — confira os dígitos.'); ok = false; primeiro = primeiro || el;
      }
    });

    // Grupos de radio obrigatórios: <div data-required-radio="nome_do_grupo">
    form.querySelectorAll('[data-required-radio]').forEach((grupo) => {
      const nome = grupo.dataset.requiredRadio;
      if (!form.querySelector('input[name="' + nome + '"]:checked')) {
        grupo.closest('.field')?.classList.add('has-error');
        const f = grupo.closest('.field');
        let span = f?.querySelector('.error-msg');
        if (f && !span) { span = document.createElement('span'); span.className = 'error-msg'; f.appendChild(span); }
        if (span) span.textContent = 'Selecione uma opção.';
        ok = false; primeiro = primeiro || grupo;
      } else {
        grupo.closest('.field')?.classList.remove('has-error');
      }
    });

    if (primeiro) {
      primeiro.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (primeiro.focus) primeiro.focus({ preventScroll: true });
    }
    return ok;
  }

  /* ------------------------------------------------------------------
     Carrinho de cotação (localStorage)
     ------------------------------------------------------------------ */
  const CART_KEY = 'skorpion_cotacao_v1';

  const carrinho = {
    listar() {
      try {
        const raw = localStorage.getItem(CART_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    },
    salvar(itens) {
      try { localStorage.setItem(CART_KEY, JSON.stringify(itens)); } catch (e) {}
      atualizarContador();
      window.dispatchEvent(new CustomEvent('skorpion:carrinho'));
    },
    adicionar(produto, quantidade) {
      const itens = carrinho.listar();
      const qtd = Math.max(1, parseInt(quantidade, 10) || 1);
      const existente = itens.find((i) => i.produto_id === produto.id);
      if (existente) {
        existente.quantidade += qtd;
      } else {
        itens.push({
          produto_id: produto.id,
          nome: produto.nome,
          unidade_venda: produto.unidade_venda || '',
          pedido_minimo: produto.pedido_minimo || '',
          foto: (Array.isArray(produto.fotos) && produto.fotos[0]) || '',
          quantidade: qtd
        });
      }
      carrinho.salvar(itens);
      return itens;
    },
    definirQuantidade(produtoId, qtd) {
      const itens = carrinho.listar();
      const item = itens.find((i) => i.produto_id === produtoId);
      if (item) item.quantidade = Math.max(1, parseInt(qtd, 10) || 1);
      carrinho.salvar(itens);
    },
    remover(produtoId) {
      carrinho.salvar(carrinho.listar().filter((i) => i.produto_id !== produtoId));
    },
    limpar() { carrinho.salvar([]); },
    total() { return carrinho.listar().reduce((s, i) => s + (i.quantidade || 0), 0); },
    contemProduto(id) { return carrinho.listar().some((i) => i.produto_id === id); }
  };

  function atualizarContador() {
    const qtd = carrinho.listar().length;
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = qtd > 99 ? '99+' : String(qtd);
      el.classList.toggle('is-visible', qtd > 0);
    });
  }

  /* ------------------------------------------------------------------
     UI
     ------------------------------------------------------------------ */
  function toast(mensagem, tipo) {
    document.querySelectorAll('.toast').forEach((t) => t.remove());
    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    const icone = tipo === 'erro'
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="#ff9d8a" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    el.innerHTML = icone + '<span></span>';
    el.querySelector('span').textContent = mensagem;
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));
    setTimeout(() => {
      el.classList.remove('is-visible');
      setTimeout(() => el.remove(), 400);
    }, 3200);
  }

  function initNav() {
    const toggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    if (toggle && nav) {
      toggle.addEventListener('click', () => {
        const aberto = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(aberto));
      });
      nav.querySelectorAll('a').forEach((a) =>
        a.addEventListener('click', () => nav.classList.remove('is-open')));
    }

    // Marca o link da página atual
    const atual = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
    document.querySelectorAll('.nav a').forEach((a) => {
      const href = (a.getAttribute('href') || '').split('?')[0].toLowerCase();
      if (href && href === atual) a.classList.add('is-active');
    });
  }

  function initReveal() {
    const alvos = document.querySelectorAll('.reveal');
    if (!alvos.length) return;
    if (!('IntersectionObserver' in window) ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      alvos.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px' });
    alvos.forEach((el) => obs.observe(el));
  }

  /* ------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------ */
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatarData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' às ' +
           d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function protocolo(uuid) {
    return String(uuid || '').replace(/-/g, '').slice(0, 8).toUpperCase();
  }

  /**
   * Gera o UUID no navegador.
   * A RLS não dá SELECT para o público, então não dá para ler o id de volta
   * depois do insert — geramos aqui e enviamos junto, e o mesmo valor vira
   * o número de protocolo mostrado ao cliente.
   */
  function novoId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues
      ? crypto.getRandomValues(b)
      : b.forEach((_, i) => { b[i] = Math.floor(Math.random() * 256); });
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' +
           h.slice(16, 20) + '-' + h.slice(20);
  }

  function slugify(texto) {
    return String(texto || '')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms || 250);
    };
  }

  function param(nome) {
    return new URLSearchParams(location.search).get(nome);
  }

  function botaoCarregando(btn, carregando, textoOriginal) {
    if (!btn) return;
    if (carregando) {
      btn.dataset.texto = textoOriginal || btn.innerHTML;
      btn.classList.add('is-loading');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Enviando...';
    } else {
      btn.classList.remove('is-loading');
      btn.disabled = false;
      if (btn.dataset.texto) btn.innerHTML = btn.dataset.texto;
    }
  }

  /** Placeholder visual quando o produto não tem foto. */
  const SEM_FOTO =
    '<div class="placeholder-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
    'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>' +
    '<polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg></div>';

  /* ------------------------------------------------------------------
     Bootstrap
     ------------------------------------------------------------------ */
  function init() {
    renderEmpresa();
    initNav();
    initReveal();
    atualizarContador();
    document.querySelectorAll('[data-ano]').forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('storage', (e) => {
    if (e.key === CART_KEY) atualizarContador();
  });

  /* ------------------------------ API ------------------------------- */
  return {
    db, configurado, avisoConfig,
    renderEmpresa, renderNumeros, linkWhatsApp, valorEmpresa, ehPlaceholder,
    validarCNPJ, mascaraCNPJ, mascaraTelefone,
    ligarCampoCNPJ, ligarCampoTelefone, validarFormulario, marcarErro, limparErro,
    carrinho, atualizarContador,
    toast, escapeHtml, formatarData, protocolo, novoId, slugify, debounce, param,
    botaoCarregando, SEM_FOTO
  };
})();
