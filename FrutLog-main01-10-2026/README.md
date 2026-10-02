<<<<<<< HEAD
# FrutLog — backend IoT seguro

## Integração MQTT ↔ backend

O frontend não deve conectar ao broker MQTT nem possuir credenciais de IoT. Use
esta arquitetura:

```text
Sensor/ESP32 -- MQTT com TLS --> Broker -- MQTT com TLS --> Ponte privada -- HTTPS --> API FrutLog --> Supabase
```

A ponte é um serviço Node.js, container ou VPS que mantém a assinatura MQTT,
valida tópico e JSON, e chama `POST /api/iot/telemetria`. Não use uma função
serverless comum para a ponte: a conexão MQTT deve permanecer aberta.

### Broker, tópicos e ACL

Use Mosquitto, EMQX ou HiveMQ com TLS na porta `8883`. Crie uma credencial para
cada sensor e outra, apenas de leitura, para a ponte. O tópico padrão é:

```text
frutlog/<SENSOR_ID>/telemetria
```

Exemplo: `frutlog/SOLO-A2-01/telemetria`.

Configure ACL para que cada dispositivo publique somente no seu próprio tópico,
sem permissão de assinar `#`. A ponte assina somente `frutlog/+/telemetria`.
Use QoS 1 e `retain: false`.

### Payload aceito

```json
{
  "sensorId": "SOLO-A2-01",
  "talhao": "A2",
  "tipo": "umidadeSolo",
  "valor": 32.4,
  "unidade": "%",
  "timestamp": "2026-09-22T14:30:00.000Z"
}
```

Obrigatórios: `sensorId`, `talhao`, `tipo` e `valor`. Tipos aceitos:
`temperatura`, `umidadeSolo`, `umidadeAr` e `chuva`. O `timestamp` é opcional.
O `sensorId` no JSON deve ser igual ao ID presente no tópico.

### Ponte de ingestão

Em um projeto separado, instale o cliente:

```powershell
npm install mqtt
```

```js
const mqtt = require("mqtt");

const client = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: `frutlog-bridge-${process.env.HOSTNAME || "local"}`,
  clean: false,
  reconnectPeriod: 5000,
  rejectUnauthorized: true,
});

client.on("connect", () => client.subscribe("frutlog/+/telemetria", { qos: 1 }));
client.on("message", async (topic, buffer) => {
  try {
    const body = JSON.parse(buffer.toString("utf8"));
    if (body.sensorId !== topic.split("/")[1]) throw new Error("sensorId diverge do tópico");
    const response = await fetch(`${process.env.FRUTLOG_API_URL}/api/iot/telemetria`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-IoT-Key": process.env.IOT_API_KEY },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`API respondeu ${response.status}`);
  } catch (error) {
    console.error("Mensagem MQTT rejeitada:", error.message);
  }
});

client.on("error", (error) => console.error("Erro MQTT:", error.message));
```

Variáveis de ambiente da ponte:

```env
MQTT_URL=mqtts://broker.exemplo.com:8883
MQTT_USERNAME=usuario-da-ponte
MQTT_PASSWORD=senha-da-ponte
FRUTLOG_API_URL=https://api.seu-dominio.com
IOT_API_KEY=mesma-chave-configurada-no-backend
```

Guarde-as em um cofre de segredos. `IOT_API_KEY` fica exclusivamente entre a
ponte e a API — nunca no sensor ou navegador.

### Banco e teste

O dispositivo precisa existir, estar ativo e pertencer ao mesmo talhão em
`dispositivos_iot`; a API rejeita o restante. Cadastre antes de publicar:

```sql
insert into dispositivos_iot (id, talhao, ativo)
values ('SOLO-A2-01', 'A2', true)
on conflict (id) do update set talhao = excluded.talhao, ativo = true;
```

Após publicar, confira `telemetrias` (histórico) e `sensores` (última leitura)
no Supabase. Em produção, use TLS também entre ponte e API, limite o tamanho de
mensagens no broker, monitore rejeições e rotacione as credenciais regularmente.

## Iniciar

No diretório do projeto, execute:

```powershell
npm.cmd start
```

A API fica em `http://localhost:3000/api`. Copie `.env.example` para `.env` e
preencha as cinco variáveis antes de iniciar. Execute todo o arquivo
`supabase/schema.sql` no **SQL Editor** do seu projeto Supabase.

No desenvolvimento local, defina `FRONTEND_ORIGIN=http://localhost:5500`. Na
Vercel, defina o domínio publicado do front, por exemplo
`https://frutlog.vercel.app`. Adicione essas mesmas variáveis em **Settings → Environment
Variables**. Nunca coloque `SUPABASE_SECRET_KEY`, `JWT_SECRET` ou
`IOT_API_KEY` no front-end ou no GitHub.

## Enviar uma leitura de um dispositivo IoT

Cada dispositivo deve chamar `POST /api/iot/telemetria`, enviando a chave no
cabeçalho `X-IoT-Key`. Em desenvolvimento, a chave padrão é
`IOT_API_KEY`, definida somente no ambiente do servidor.

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:3000/api/iot/telemetria `
  -Headers @{ "X-IoT-Key" = "SUA_CHAVE_IOT" } `
  -ContentType "application/json" `
  -Body '{"sensorId":"SOLO-A2-01","talhao":"A2","tipo":"umidadeSolo","valor":32}'
```

Campos da telemetria: `sensorId`, `talhao`, `tipo`, `valor`; opcionais:
`unidade` e `timestamp` (ISO 8601). Tipos aceitos no painel: `temperatura`,
`umidadeSolo`, `umidadeAr` e `chuva`.

Para criar uma senha de usuário, execute `npm.cmd run password-hash --
"SuaSenhaForte"` e grave o resultado na coluna `senha_hash` da tabela
`usuarios`, junto com matrícula, nome e perfil.

Cada leitura e registro operacional é salvo no Supabase. A API usa CORS somente
para `FRONTEND_ORIGIN`, JWT com expiração de 8 horas, senhas PBKDF2 e limite de
120 requisições por minuto por IP. Cadastre o hash PBKDF2 de cada usuário na
tabela `usuarios`; não salve senhas em texto puro.
=======
# FrutLog

Sistema web para gestao agricola, monitoramento de talhoes, acompanhamento de sensores, registro de inspecoes de campo e controle administrativo de funcionarios.

O projeto foi desenvolvido como prototipo frontend para o Projeto Integrador. A interface ja esta preparada para integracao futura com backend e banco de dados.

## Sobre o Projeto

O FrutLog tem como objetivo auxiliar o acompanhamento da producao agricola por meio de paineis separados por perfil de usuario.

Cada perfil possui uma visao especifica do sistema:

- **Engenheiro agronomo:** acompanha talhoes, telemetria, historico mensal, previsao de colheita e cadastro de plantio.
- **Tecnico agricola:** registra inspecoes, ocorrencias, problemas em sensores e acompanha tarefas de campo.
- **Administrador:** gerencia funcionarios, visualiza usuarios ativos, mapa da fazenda e graficos gerais.

## Funcionalidades

- Tela inicial com redirecionamento por sessao.
- Login em modo demonstracao por perfil.
- Dashboard para engenheiro agronomo.
- Dashboard para tecnico agricola.
- Dashboard administrativo.
- Mapa visual dos talhoes com selecao interativa.
- Exibicao de status dos talhoes: normal, atencao e critico.
- Tabelas de telemetria, sensores, inspecoes e usuarios ativos.
- Graficos com Chart.js.
- Formularios de cadastro e registro preparados para envio ao backend.
- Controle basico de sessao usando `sessionStorage`.
- Teste smoke com Playwright para validar carregamento das paginas.

## Status Atual

O sistema esta em **modo demonstracao**.

Nesta etapa, os dados ainda sao simulados no frontend. O banco de dados e o backend ainda nao estao conectados, mas o projeto ja possui estrutura preparada para API em `js/global.js`.

Quando o backend estiver pronto, sera necessario ativar a autenticacao real e substituir os dados locais por chamadas HTTP.

## Tecnologias Utilizadas

- HTML5
- CSS3
- JavaScript
- Chart.js
- Font Awesome
- Playwright
- Live Server

## Estrutura do Projeto

```txt
.
├── admin.html
├── eng.html
├── index.html
├── login.html
├── tec.html
├── css/
│   ├── admin.css
│   ├── dashboard.css
│   ├── eng.css
│   ├── global.css
│   ├── index.css
│   ├── login.css
│   └── tec.css
├── js/
│   ├── admin.js
│   ├── eng.js
│   ├── global.js
│   ├── index.js
│   ├── login.js
│   └── tec.js
├── imagem/
│   ├── fotinha.png
│   └── mapa-FrutLog.jpg
├── frutlog-smoke.spec.js
└── RELATORIO_FRUTLOG.md
```

## Como Executar

1. Clone o repositorio:

```bash
git clone <url-do-repositorio>
```

2. Acesse a pasta do projeto:

```bash
cd <nome-da-pasta>
```

3. Abra o projeto com o Live Server.

4. Acesse a pagina inicial:

```txt
http://localhost:5501/index.html
```

Caso a porta do seu Live Server seja diferente, ajuste a URL conforme a porta exibida no VS Code.

## Como Usar em Modo Demonstracao

1. Abra `login.html`.
2. Digite uma matricula qualquer.
3. Digite uma senha com pelo menos 8 caracteres.
4. Escolha o perfil de demonstracao:
   - Engenheiro
   - Tecnico
   - Admin
5. Clique em **Entrar**.

O sistema redirecionara para o painel correspondente ao perfil escolhido.

## Preparacao Para Backend

O arquivo principal para integracao futura e:

```txt
js/global.js
```

Nele existem duas configuracoes importantes:

```js
const API_BASE_URL = "http://localhost:3000/api";
const AUTENTICACAO_API_ATIVA = false;
```

Quando o backend estiver pronto, a autenticacao real podera ser ativada alterando:

```js
const AUTENTICACAO_API_ATIVA = true;
```

Rotas previstas para integracao:

- `POST /api/login`
- `GET /api/talhoes`
- `POST /api/plantios`
- `GET /api/inspecoes`
- `POST /api/inspecoes`
- `POST /api/ocorrencias`
- `GET /api/sensores`
- `POST /api/sensores/problemas`
- `GET /api/funcionarios`
- `POST /api/funcionarios`
- `GET /api/sessoes`
- `GET /api/dashboard/colheitas`
- `GET /api/dashboard/clima`

## Observacoes de Desenvolvimento

- Os dados atuais sao demonstrativos.
- A validacao de seguranca real deve ser feita no backend.
- O frontend nao deve armazenar senhas.
- O controle de perfil feito no navegador e apenas uma simulacao ate a API estar pronta.
- O arquivo `RELATORIO_FRUTLOG.md` contem uma explicacao mais detalhada das classes, IDs, arquivos e pontos de manutencao.

## Melhorias Futuras

- Criar backend com autenticacao real.
- Integrar banco de dados.
- Centralizar dados simulados em um arquivo unico.
- Criar camada propria de API em `js/api.js`.
- Adicionar CRUD completo de funcionarios, talhoes, plantios e sensores.
- Melhorar acessibilidade do mapa.
- Adicionar mais testes automatizados.
- Substituir dependencias via CDN por arquivos locais ou processo de build.
- Implementar logs e auditoria para acoes administrativas.
- Aplicar validacoes de seguranca no backend.

## Autores

Projeto desenvolvido para fins academicos no Projeto Integrador.

Adicione aqui os nomes dos integrantes do grupo:

- Nome 1
- Nome 2
- Nome 3
- Nome 4

>>>>>>> 26e58ccf857d3371e4f1c9dac6e93159450c6275
