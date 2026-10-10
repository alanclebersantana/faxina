# 🧹 Bora pra Faxina!

Checklist da rotina de faxina da casa, um cômodo por dia, com sincronização entre aparelhos, medalhas, alerta de atraso, fechamento semanal, painel com calendário e backup.

PWA em arquivo único (`index.html`), sem ferramentas de build. Hospedado no **GitHub Pages**, com login e banco de dados no **Firebase** (Authentication + Firestore).

---

## 📁 Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | O app inteiro (HTML, CSS e JavaScript) |
| `instalar.html` | Página de instalação com instruções para Android, iPhone e computador |
| `manifest.json` | Nome, cores e ícones para instalar no celular |
| `sw.js` | Service worker: abre o app offline e mostra as notificações |
| `icons/` | Ícones do app (192, 512, maskable, Apple e o ícone da barra de notificações) |
| `notificacoes/` | Script que envia os lembretes (roda no GitHub Actions) |
| `.github/workflows/lembretes.yml` | Agenda o envio dos lembretes a cada 15 minutos |
| `firestore.rules` | Regras de segurança do banco de dados |

---

## 1. Criar o projeto no Firebase

1. Acesse <https://console.firebase.google.com> e clique em **Adicionar projeto**. Use um nome como `bora-pra-faxina`. O Google Analytics pode ficar desligado.
2. No menu lateral, abra **Criação → Authentication → Primeiros passos**.
   - Na aba **Método de login**, ative o **Google** e informe o seu e-mail de suporte.
   - Ative também **E-mail/senha**, se quiser essa opção.
3. Ainda em Authentication, abra **Configurações → Domínios autorizados → Adicionar domínio** e informe:
   - `SEU-USUARIO.github.io` (troque pelo seu usuário do GitHub)
4. No menu lateral, abra **Criação → Firestore Database → Criar banco de dados**.
   - Escolha o **modo de produção**.
   - Região: `southamerica-east1 (São Paulo)`.
5. No Firestore, abra a aba **Regras**, apague o conteúdo, cole o conteúdo de `firestore.rules` e clique em **Publicar**.

## 2. Colar a configuração no app

1. No Firebase, clique na engrenagem ⚙️ → **Configurações do projeto**.
2. Em **Seus apps**, clique no ícone **`</>`** (Web), dê um nome e registre o app. Não precisa do Hosting.
3. Copie o objeto `firebaseConfig` que aparece.
4. Abra o `index.html`, procure por **`FIREBASE_CONFIG`** (logo no início do `<script>`) e substitua os valores pelos do seu projeto:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "bora-pra-faxina.firebaseapp.com",
  projectId: "bora-pra-faxina",
  storageBucket: "bora-pra-faxina.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

> A `apiKey` do Firebase pode ficar pública no GitHub. Quem protege os dados são as regras do Firestore e os domínios autorizados.

## 3. Publicar no GitHub Pages

1. Crie um repositório, por exemplo `bora-pra-faxina`.
2. Envie todos os arquivos desta pasta, mantendo a pasta `icons/`.
3. No repositório, abra **Settings → Pages**. Em **Branch**, escolha `main` e a pasta `/ (root)`, e clique em **Save**.
4. Em 1 ou 2 minutos o app estará em `https://SEU-USUARIO.github.io/bora-pra-faxina/`.

## 4. Instalar no celular

Mande para a família o link da página de instalação: `https://SEU-USUARIO.github.io/bora-pra-faxina/instalar.html`. Ela detecta o aparelho e mostra o passo a passo certo. O botão **Convidar** do app já envia esse link com o código.


- **Android (Chrome):** abra o link e toque em **⋮ → Instalar app** (ou **Adicionar à tela inicial**).
- **iPhone (Safari):** abra o link e toque em **Compartilhar → Adicionar à Tela de Início**.

## 5. Usar em família

1. A primeira pessoa entra com a conta e toca em **Criar casa**. A casa já vem com a rotina completa de faxina.
2. Em **Ajustes → Casa**, toque em **Convidar** para mandar o link e o **código de convite** pelo WhatsApp.
3. As outras pessoas abrem o link, entram com a própria conta, tocam em **Tenho um código de convite** e digitam o código.
4. Em **Ajustes → Pessoas da casa**, cadastre todo mundo, inclusive quem não tem conta (por exemplo, a Laura).
5. Em cada aparelho, toque no **avatar do topo** para escolher quem está marcando as tarefas.

## 6. Ativar os lembretes no celular 🔔

Os lembretes chegam **mesmo com o app fechado**. Quem envia é um robô gratuito do GitHub (GitHub Actions), que roda a cada 15 minutos, confere no Firebase quem tem lembrete vencido e dispara a notificação pelo Firebase Cloud Messaging. **Não precisa do plano pago do Firebase.**

### 6.1 Chave das notificações (VAPID)

1. No Firebase, clique na engrenagem ⚙️ → **Configurações do projeto → Cloud Messaging**.
2. Em **Configuração da Web → Certificados push da Web**, clique em **Gerar par de chaves**.
3. Copie a chave (um texto longo que começa com `B`).
4. No `index.html`, logo abaixo do `FIREBASE_CONFIG`, cole a chave em:

```js
const FIREBASE_VAPID_KEY = "BJx...sua-chave...";
```

### 6.2 Conta de serviço (para o robô enviar)

1. No Firebase: ⚙️ → **Configurações do projeto → Contas de serviço**.
2. Clique em **Gerar nova chave privada** e confirme. Um arquivo `.json` será baixado.
3. No GitHub, abra o repositório e vá em **Settings → Secrets and variables → Actions → New repository secret**.
   - **Name:** `FIREBASE_SERVICE_ACCOUNT`
   - **Secret:** cole **todo o conteúdo** do arquivo `.json`
4. Clique em **Add secret**. Depois apague o arquivo `.json` do seu computador.

> ⚠️ Nunca envie esse `.json` para o repositório. Ele dá acesso total ao seu Firebase e só pode ficar guardado como *secret*.

### 6.3 Ligar o robô

1. Envie para o GitHub também as pastas `notificacoes/` e `.github/` (a pasta `.github` começa com ponto e fica oculta em alguns computadores).
2. No repositório, abra a aba **Actions**. Se aparecer um aviso, clique em **I understand my workflows, go ahead and enable them**.
3. Clique em **Lembretes → Run workflow** para testar. Em uns 30 segundos o resultado aparece em verde ✅ com a mensagem `0 aparelho(s) com lembrete vencido`.

### 6.4 No celular

1. Abra o app **instalado** e toque em **Ativar** (no aviso da tela Hoje ou em **Ajustes → Lembretes no celular**).
2. Permita as notificações quando o celular perguntar.
3. Ajuste os horários e os dias como quiser. Cada aparelho tem os próprios lembretes.
4. Toque em **Testar**. Uma notificação aparece na hora, e outra, enviada pelo robô, chega em até 15 minutos.

| Lembrete | Quando toca |
|---|---|
| ☀️ Tarefas do dia | No horário escolhido, com o cômodo do dia e quantas tarefas faltam |
| ⚠️ Se faltar algo | Só se ainda houver tarefas do dia ou atrasadas |
| ✨ Faxina do mês | No sábado escolhido na aba Mensal, se a faxina pesada não estiver completa |
| 💡 Mensagem livre | O texto que você escrever, nos dias e horários escolhidos |

**Bom saber:**
- **iPhone:** funciona no iOS 16.4 ou mais novo, e só com o app **instalado na tela de início** pelo Safari.
- **Precisão:** o GitHub pode atrasar alguns minutos, principalmente na hora cheia. O lembrete chega em até uns 15 minutos do horário. Se o atraso passar de 2 horas, aquele lembrete é pulado para não tocar fora de hora.
- **Repositório parado:** o GitHub pausa agendamentos de repositórios sem nenhuma atividade por 60 dias. O robô tenta se manter ligado sozinho, mas se você receber um e-mail do GitHub avisando da pausa, é só abrir **Actions → Lembretes → Enable workflow**.
- **Custo:** o GitHub Actions é gratuito em repositórios públicos (como os do GitHub Pages gratuito), e o envio pelo Firebase Cloud Messaging também é gratuito.

---

## ☁️ Sincronização e backup

- Tudo o que é marcado aparece em tempo real em todos os aparelhos da casa.
- **Funciona offline**: as marcações ficam guardadas no aparelho e sobem para a nuvem quando a conexão volta. O indicador no topo mostra **sync**, **salvando** ou **offline**.
- **Backup automático na nuvem** acontece uma vez por dia e a cada semana fechada. O app guarda os 30 últimos.
- Em **Ajustes → Backup** você pode:
  - fazer um backup agora;
  - **baixar um arquivo `.json`**, para guardar no Drive ou no computador;
  - **restaurar** de um backup da nuvem ou de um arquivo. Antes de restaurar, o app faz um backup do estado atual.

## 🗓️ Como a semana funciona

- A semana vai de **segunda a domingo**.
- Tarefas de dias anteriores que não foram feitas aparecem como **atrasadas** no dia seguinte.
- No **domingo**, o botão **Fechar semana** salva o progresso no histórico.
- Se ninguém fechar no domingo, na **segunda** o app pergunta o que fazer com as pendências: **levar para a próxima semana** ou **descartar**, item por item ou todas de uma vez.
- A **faxina mensal** tem o mês inteiro de prazo. Os itens que ficarem pendentes aparecem como atrasados no mês seguinte.

## 🏅 Medalhas

| Medalha | Como ganhar |
|---|---|
| 🥉 Bronze | Concluir um cômodo |
| 🥈 Prata | Concluir o dia 100% |
| 🥇 Ouro | Concluir a semana inteira (ou a faxina do mês) |
| 🔥 Sequência | 7, 15 e 30 dias seguidos sem atraso |

## 🔄 Publicar uma atualização

Depois de alterar o `index.html`, abra o `sw.js` e aumente o número da versão:

```js
const CACHE = 'bora-pra-faxina-v3';
```

Assim os celulares baixam a versão nova na próxima vez que abrirem o app.

## 🗄️ Estrutura no Firestore

```
usuarios/{uid}                  → { casaId }
codigos/{CODIGO}                → { casaId }
casas/{casaId}                  → nome, código, membros, config (cômodos, dias, pessoas),
                                  histórico de semanas, recorde, meses
casas/{casaId}/semanas/{segunda-feira}  → checks, medalhas, pendências levadas, fechada
casas/{casaId}/meses/{AAAA-MM}          → checks da faxina mensal, sábado escolhido, atrasados
casas/{casaId}/backups/{id}             → cópia completa em JSON
dispositivos/{id}                       → aparelho que recebe lembretes: token, casa, pessoa,
                                          fuso horário, lembretes e próximo envio
```

Paleta de cores, modo claro/escuro e lembretes são escolhas de cada aparelho.

> Depois de atualizar o `firestore.rules`, lembre de colar o conteúdo novo em **Firestore → Regras → Publicar**. A versão com lembretes inclui a coleção `dispositivos`.
