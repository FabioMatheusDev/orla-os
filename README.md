<p align="center"><img src=".github/orla.jpg" alt="orla" width="720"></p>

<h1 align="center">orla</h1>

<p align="center"><b>Uma tela inicial limpa, rápida e bonita para a sua TV.</b><br>
Sem anúncios. Seus apps, o que está em alta e a TV ao vivo, num só lugar.</p>

---

## O que é

A **orla** substitui a tela inicial da sua Fire TV. Em vez de uma tela cheia de
propagandas e sugestões que você não pediu, você vê:

- **Seus apps** numa barra no rodapé, na ordem que você escolher.
- **O que está em alta** nos filmes e nas séries, com capa, sinopse e um botão
  **"Abrir no Netflix"** (ou no app onde o título está disponível).
- **Detalhes** de cada título: elenco, notas, trailer, temporadas e onde assistir.
- **TV ao vivo**, clima, relógio e atalhos para as configurações da TV.
- Uma **abertura** curta quando a TV liga.

Ela é grátis, é sua e não envia nada para nenhum servidor nosso: não existe servidor.

> A orla organiza e abre os apps que você já tem. Ela **não** traz filmes, assinaturas
> ou acesso grátis a serviços de streaming.

## Funciona na minha TV?

**Sim, com a ajuda de um agente de IA.** O projeto vem com um guia ([AGENTS.md](AGENTS.md))
que ensina o agente a instalar e, quando preciso, **adaptar a orla para a sua TV**,
seguindo as regras oficiais de cada fabricante.

| TV ou aparelho | Como o agente instala |
|---|---|
| **Fire TV** (Fire OS: Fire TV Stick, Cube, TVs Fire TV) | Pronta: instala direto |
| **Google TV / Android TV** (Chromecast, TCL, Sony, Philips, Xiaomi…) | Instala o mesmo app e ajusta os atalhos da TV |
| **LG** (webOS) | Cria a versão LG e instala pelo Developer Mode da LG |
| **Samsung** (Tizen, 2017+) | Cria a versão Samsung e instala pelo modo desenvolvedor da Samsung |
| **Fire TV com Vega OS** (modelos novos) | Cria a versão Vega com o kit de desenvolvimento da Amazon |
| Outras (Roku, VIDAA…) | O agente verifica se há caminho oficial; se não, sugere um Fire TV Stick ou Google TV no HDMI |

Na Fire TV, a orla já foi testada e assume o botão Home. Nas outras, o agente faz a
adaptação na hora. Em LG e Samsung ela abre como um app (as teclas de atalho e o "abrir o
último app" da TV deixam a orla a um clique). Detalhes em [COMPATIBILITY.md](COMPATIBILITY.md).

## Como instalar

### 1. Tenha um agente de IA no computador

Qualquer um destes serve (todos rodam no Windows, Mac e Linux):

- [Claude Code](https://claude.com/claude-code) (Anthropic)
- [Codex](https://openai.com/codex/) (OpenAI)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) ou [Antigravity](https://antigravity.google/) (Google)

O computador e a TV precisam estar **na mesma rede Wi-Fi**.

### 2. Baixe a orla

Peça ao próprio agente: *"Baixe o projeto https://github.com/FabioMatheusDev/orla-os"*,
ou, se preferir, rode `git clone https://github.com/FabioMatheusDev/orla-os.git`.
Depois abra o agente **dentro da pasta `orla-os`**.

### 3. Peça a instalação

Copie e cole, trocando pelos seus dados:

> Leia o arquivo **AGENTS.md** e instale a orla na minha TV.
> Minha TV é uma **[marca e modelo, ex.: Fire TV Stick 4K / LG C3 / Samsung Crystal 2023]**,
> o IP dela é **[ex.: 192.168.0.50]** e eu moro em **[cidade]**.

O agente vai:

- conferir o que falta no computador e instalar (com o seu ok);
- dizer o que **você** precisa fazer na TV, como ligar o modo desenvolvedor, aceitar um
  aviso ou entrar na conta do fabricante;
- adaptar e instalar a orla, e mostrar como usar e como desfazer.

**Você não precisa entender nada de programação.** Só siga o que ele pedir na TV.

> Não sabe o IP da TV? Pergunte ao agente: ele explica onde achar no menu da sua TV.

### 4. (Opcional) Coloque suas chaves

Para ver filmes e séries em alta, crie uma chave grátis do [TMDB](https://www.themoviedb.org/)
(e, se quiser as notas do IMDb e do Rotten Tomatoes, do [MDBList](https://mdblist.com/)).
Depois, **no controle da TV**, aperte **☰ → Catálogo e chaves** e digite. As chaves ficam
guardadas **só na sua TV**. **Não cole as chaves no chat do agente.**

> **Como pegar a chave do TMDB:** crie uma conta em themoviedb.org, abra
> **Configurações → API → Criar → Developer**, preencha o formulário (uso pessoal) e copie
> a **Chave da API**.

<details>
<summary>Prefiro instalar sem agente (Fire TV)</summary>

Você vai precisar de Git, Java JDK 17+, Node.js 20+ e Android SDK (platform 34,
build-tools 34) com ADB. Na Fire TV: Configurações → Minha Fire TV → Sobre → clique 7 vezes
no nome do aparelho → Opções do desenvolvedor → **Depuração ADB: Ligado**. Depois, na pasta
do projeto:

```powershell
.\scripts\install.ps1 -Ip 192.168.0.50      # Windows
./scripts/install.sh 192.168.0.50          # Mac / Linux (antes: chmod +x gradlew scripts/*.sh)
```

Aceite **"Permitir depuração USB"** na TV, marcando **"Sempre permitir"**. Para as outras
TVs, os passos estão no [AGENTS.md](AGENTS.md).

</details>

## Como usar

| Quero... | Faça assim |
|---|---|
| Abrir um app | Desça até a barra e aperte **OK** |
| Mudar a ordem dos apps | **Segure OK** num app e use **← →**. **OK** salva, **Voltar** cancela |
| Ver apps que não estão na barra | Passe o app pelo card **Todos**, ou segure **OK** no **Todos** |
| Ver todos os apps e a TV ao vivo | Card **Todos** na barra |
| Ver detalhes de um filme ou série | **Detalhes**, no destaque ou em qualquer capa |
| Mudar o visual | **☰ → Visual**: *Vidro* (bonito) ou *Sólido* (mais rápido) |
| Desligar os sons ou a abertura | **☰ → Sons da interface** / **Abertura ao ligar a TV** |
| Abrir as configurações da TV | Ícone de engrenagem no topo |

> Se a navegação parecer lenta, use o visual **Sólido**: no Fire TV Stick ele fica bem
> mais fluido.

## Como desfazer

O mais fácil: peça ao agente *"desfaça a instalação da orla"*. Ele sabe o caminho de volta
de cada TV. Na Fire TV, a tela da Amazon nunca é apagada, e também dá para voltar
pela própria TV, em **☰ → Restaurar tela original do Fire TV**.

## Perguntas frequentes

**É pirataria?** Não. A orla só mostra o que está em alta e abre os apps que você já
assina.

**Mexe em alguma coisa da minha TV?** Ela instala o app. Na Fire TV, também liga um serviço
de acessibilidade que só percebe quando a tela inicial da Amazon aparece, para trazer a orla
de volta: ele não lê o que está na tela. O agente é instruído a não desativar apps, não
mudar rede, imagem ou som, e a pedir sua autorização antes de qualquer mudança no sistema.

**É seguro deixar um agente de IA mexer?** Ele roda comandos no seu computador e na TV,
sempre explicando antes. O guia proíbe factory reset, root e apagar apps do sistema, e
exige um jeito de desfazer cada mudança. Leia o que ele propõe antes de aceitar.

**Minhas chaves estão seguras?** Elas ficam cifradas na própria TV e não vão para nenhum
servidor nem para este repositório.

**Como atualizo?** Peça ao agente: *"atualize a orla na minha TV"*. Suas chaves, favoritos
e a ordem da barra continuam.

**Preciso deixar o computador ligado?** Não. Ele só é usado para instalar.

**A TV ao vivo não aparece.** Ela só aparece quando a TV tem um app de TV ao vivo, como
o Live TV da Amazon ou o Live Channels do Google.

## Para desenvolvedores

Como compilar, testar, a estrutura do código, a segurança das chaves e como a abertura
é gerada: [DEVELOPMENT.md](DEVELOPMENT.md). Para adaptar a orla a outras TVs, veja o
[kit de ports](ports/README.md).

## Créditos

Baseada no [Free My TV](https://github.com/simbasjungles/free-my-tv), licença MIT,
preservada em [LICENSE](LICENSE). Avisos de terceiros em
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Dados de filmes e séries: [TMDB](https://www.themoviedb.org/). Onde assistir: JustWatch,
via TMDB. Notas: [MDBList](https://mdblist.com/).
*This product uses the TMDB API but is not endorsed or certified by TMDB.*
