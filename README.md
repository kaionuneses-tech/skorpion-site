# Site Skorpion — Trading & Distribuição

Site institucional de duas frentes (serviço de importação + catálogo de revenda no
atacado), com painel administrativo e banco no Supabase.

HTML, CSS e JavaScript puros — **sem build, sem npm**. Tudo que é externo entra por CDN
(Supabase JS, Three.js e a fonte Inter).

---

## 1. Para colocar no ar (3 passos)

### Passo 1 — Criar o banco no Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor → New query**.
3. Cole o conteúdo inteiro de [`supabase-schema.sql`](supabase-schema.sql) e clique em **Run**.

Isso cria as quatro tabelas (`categorias`, `produtos`, `solicitacoes_importacao`,
`solicitacoes_revenda`), as políticas de RLS, os gatilhos de `updated_at` e o bucket
de fotos no Storage. O script pode ser executado mais de uma vez sem quebrar nada.

### Passo 2 — Ligar o site ao banco

No painel do projeto, clique em **Connect** (ou vá em **Settings → API Keys**) e
copie a `Project URL` e a **Publishable key** (`sb_publishable_...`). Projetos antigos
mostram a chave legada `anon public`, que também funciona.
Abra `assets/js/config.js` e preencha:

```js
supabase: {
  url:     'https://xxxxxxxx.supabase.co',
  anonKey: 'sb_publishable_...'
}
```

A chave publishable pode ficar no front-end — quem protege os dados é a RLS, não a chave.
**Nunca** use aqui a chave `secret` (`sb_secret_...`) nem a `service_role`.

### Passo 3 — Criar o usuário do painel

Em **Authentication → Users → Add user**, crie o e-mail e a senha de quem vai acessar
o `admin.html`. Não existe cadastro público: só entra quem for criado ali.

---

## 2. Preencher os dados da empresa

Todos os textos entre colchetes — `[(00) 0000-0000]`, `[Razão Social]` etc. — aparecem
**destacados em amarelo** no site. Isso é proposital: é o mapa do que falta preencher.

Está tudo num único lugar: **`assets/js/config.js`**.

| Campo | Onde aparece |
|---|---|
| `empresa.telefone`, `email`, `horario` | barra superior, rodapé, contato |
| `empresa.whatsapp` | todos os botões de WhatsApp (só dígitos, com o 55: `5511999999999`) |
| `empresa.razaoSocial`, `cnpj` | rodapé e bloco "Dados da empresa" |
| `empresa.endereco`, `bairro`, `cidadeUf`, `cep` | rodapé e contato |
| `empresa.encarregado` | encarregado de dados (LGPD), na `privacidade.html` |
| `numeros[]` | a barra de números da home (anos de atuação, países, processos, clientes) |
| `empresa.linkedin`, `instagram` | deixe `''` para o link simplesmente não aparecer |

Ao trocar um valor, o destaque amarelo some sozinho em todas as páginas.

---

## 3. Publicar

O site é estático: sobe em qualquer hospedagem.

**Este site está no GitHub Pages**, no repositório
`kaionuneses-tech/skorpion-site`, servido em `skorpionimportexport.com.br` (o arquivo
`CNAME` guarda o domínio). Para atualizar, basta enviar as alterações:

```powershell
git add -A; git commit -m "Descreva a alteração"; git push
```

O GitHub republica sozinho em 1 ou 2 minutos.

O DNS do domínio fica no registro.br e o e-mail é do Zoho. Para ligar o site, foram
**adicionados** 4 registros `A` (185.199.108.153, 185.199.109.153, 185.199.110.153,
185.199.111.153) e um `CNAME` `www` → `kaionuneses-tech.github.io`. Nunca troque os
servidores DNS nem apague os registros MX/TXT, senão o e-mail para.

- **Netlify / Vercel / Cloudflare Pages** — arraste a pasta inteira.
- **Hospedagem tradicional (cPanel, FTP)** — envie tudo para `public_html`.
- **GitHub Pages** — suba o repositório e ative o Pages.

Depois de publicar, vá em **Supabase → Authentication → URL Configuration** e
inclua o domínio do site em **Site URL / Redirect URLs**.

### Domínio (Google e prévia em redes sociais)

O `robots.txt`, o `sitemap.xml` e as tags de prévia (`og:`) precisam do endereço
completo do site, e o Google e o WhatsApp leem esses arquivos sem rodar JavaScript.
Por isso o domínio não fica no `config.js`: troque **`SEU-DOMINIO.com.br`** pelo seu
domínio real em todos os arquivos de uma vez (no VS Code: **Ctrl+Shift+H**). Ele aparece
em `robots.txt`, `sitemap.xml`, `index.html`, `importacao.html`, `produtos.html` e
`privacidade.html`.

Para a prévia ficar bonita no WhatsApp e no LinkedIn, o ideal é uma imagem de
1200 × 630 px; hoje ela usa `assets/img/logo.jpg`.

### Política de privacidade

A `privacidade.html` usa os dados do `config.js` (razão social, CNPJ, endereço, e-mail e
encarregado). O texto é um modelo baseado no que o site realmente coleta — vale uma
revisão de um advogado antes de publicar.

### Testar no seu computador antes de publicar

Abrir os arquivos com duplo clique (`file://`) funciona mal em algumas partes.
Como esta máquina não tem Python nem Node instalados, incluí um servidor pronto:

1. clique com o botão direito em **`servidor-local.ps1`** → **Executar com o PowerShell**;
2. abra <http://localhost:8765/> no navegador;
3. para parar, feche a janela do PowerShell.

Esse arquivo é só para teste local — não precisa subir para a hospedagem.

---

## 4. Estrutura

```
index.html            Home: hero 3D, duas chamadas, quem somos, segmentos, contato
importacao.html       Serviços, modalidades, passo a passo, sigilo, formulário
produtos.html         Catálogo com filtro por categoria e busca
produto.html?id=      Ficha do produto, galeria e "adicionar à cotação"
cotacao.html          Lista escolhida (localStorage) + dados da empresa → banco
admin.html            Login, CRUD de catálogo e as duas filas de solicitações
privacidade.html      Política de privacidade (LGPD)
robots.txt            Esconde admin e cotação do Google, aponta o sitemap
sitemap.xml           Páginas públicas para o Google
supabase-schema.sql   Todo o SQL: tabelas, RLS, triggers e bucket de fotos
servidor-local.ps1    Servidor só para pré-visualizar no seu PC (não precisa publicar)

assets/css/style.css  Design system inteiro (cores, componentes, responsivo)
assets/js/config.js   >>> O arquivo que você edita <<<
assets/js/app.js      Base comum: Supabase, placeholders, carrinho, CNPJ, máscaras
assets/js/hero3d.js   Cena 3D: globo, rotas e o avião decolando
assets/js/importacao.js · produtos.js · produto.js · cotacao.js · admin.js
assets/img/logo.jpg   Logomarca
```

---

## 5. Como funciona cada parte

### Paleta

Extraída da própria logomarca:

| Cor | Hex | Onde veio |
|---|---|---|
| Trigo / âmbar | `#F8A838` | espiga de trigo |
| Verde folha | `#98C858` / `#789858` | folhas |
| Azul globo | `#58A8FF` / `#68D8FF` | globo terrestre |
| Navy institucional | `#0A2135` / `#05131F` | aprofundamento do azul do globo |

O navy carrega o peso corporativo; âmbar e verde entram só como acento, para o site
passar credibilidade sem ficar sisudo. O âmbar marca sempre a frente de **revenda**;
o azul, a frente de **importação**.

### A animação 3D

`assets/js/hero3d.js` monta com Three.js um globo de pontos com meridianos e brilho
atmosférico, desenha as rotas de comércio exterior como arcos e faz um avião
(construído com primitivas, sem arquivo de modelo) percorrer a rota: corrida de
decolagem acelerando sobre a superfície, subida, cruzeiro deixando um rastro
luminoso e pouso no destino. No fim do trajeto a rota é trocada e o ciclo recomeça.

- Em `prefers-reduced-motion`, renderiza **um quadro estático** em vez de animar.
- Sem WebGL, o canvas simplesmente não aparece e fica o gradiente do CSS.
- A animação pausa quando a aba sai de foco ou o hero sai da tela.
- Para trocar as rotas, edite `PONTOS` e `ROTAS` no topo do arquivo.

### Validação de CNPJ

`SK.validarCNPJ()` em `assets/js/app.js` confere os **dois dígitos verificadores**
pelo módulo 11 e rejeita sequências repetidas (`00.000.000/0000-00`). É aplicada nos
formulários de importação e de cotação, com máscara enquanto se digita.

### Carrinho de cotação

Fica em `localStorage`, na chave `skorpion_cotacao_v1`. Guarda id, nome, unidade de
venda, foto e quantidade de cada item. O contador no cabeçalho acompanha em todas as
páginas, inclusive entre abas. Ao enviar a cotação com sucesso, a lista é apagada.

### Fotos dos produtos

No `admin.html`, cada imagem é redimensionada **no navegador** para no máximo
1200 px no maior lado e recomprimida em JPEG (qualidade 0,82) antes de subir para o
bucket `produtos` do Storage. No banco fica só a lista de URLs, em `jsonb`. A
primeira foto é a capa. Ajuste `MAX_DIM` e `QUALIDADE` no topo de `assets/js/admin.js`.

---

## 6. Segurança (RLS)

| Tabela | Público (anon) | Autenticado |
|---|---|---|
| `categorias` | lê apenas `ativo = true` | tudo |
| `produtos` | lê apenas `ativo = true` | tudo |
| `solicitacoes_importacao` | **só insere** (com `status = 'novo'` e sem anotação interna), não lê | tudo |
| `solicitacoes_revenda` | **só insere** (com `status = 'novo'` e sem anotação interna), não lê | tudo |

Ou seja: qualquer visitante envia um formulário, mas **ninguém consegue listar as
solicitações** sem estar logado — nem pelo console do navegador, nem chamando a API
direto com a chave `anon`. Por isso os formulários geram o UUID no próprio navegador:
como não há permissão de leitura, o `insert` não pode devolver o registro, e o número
de protocolo mostrado ao cliente é esse id gerado localmente.

Quem chama a API direto também não consegue forjar a fila: a política de insert recusa
qualquer `status` diferente de `novo` ou uma `observacoes_internas` preenchida, e o
gatilho grava `created_at`/`updated_at` com a hora do servidor.

Um produto inativo também some do site por RLS, não só por filtro de tela.

---

## 7. Dúvidas frequentes

**O catálogo aparece vazio.**
Rode o SQL (passo 1) e cadastre produtos em `admin.html` com **Ativo** marcado.

**As fotos não sobem.**
O bucket `produtos` é criado pelo `supabase-schema.sql`. Confira em **Storage** se
ele existe e está como público.

**Aparece "Supabase ainda não configurado".**
Falta o passo 2: `url` e `anonKey` em `assets/js/config.js`.

**Quero mudar os segmentos atendidos / os textos da home.**
São conteúdo direto no HTML. Em `index.html`, procure a seção `id="segmentos"`.

**O formulário de contato da home.**
A home não tem formulário genérico de propósito: as duas frentes têm formulários
próprios (importação e cotação), que já chegam com as informações certas para o time
responder. O bloco de contato leva para eles e mostra WhatsApp, telefone e e-mail.
