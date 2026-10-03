# FrutLog — Sistema de Gestão Agrícola e Monitoramento IoT

Sistema web completo para gestão agrícola, monitoramento de talhões com sensores IoT, acompanhamento de telemetria em tempo real, registro de inspeções de campo e controle administrativo de usuários.

---

## 🌾 Sobre o Projeto

O **FrutLog** centraliza o ciclo operacional do cultivo agrícola através de painéis especializados por perfil de atuação:

*   **Engenheiro Agrônomo:** Edição sincronizada da geometria e da área dos talhões, acompanhamento de dados reais de sensores e cadastro de ciclos de plantio.
*   **Técnico Agrícola:** Monitoramento de campo, inspeções, ocorrências, problemas em sensores e envio de relatório diário.
*   **Administrador:** Gestão de funcionários e sensores, dados operacionais consolidados, mapa e acompanhamento de relatórios.

---

## 🏛️ Arquitetura do Sistema

A arquitetura do FrutLog é projetada para garantir segurança, desacoplamento e integridade dos dados:

```text
[Sensores / ESP32]
       │ (MQTT c/ TLS porta 8883)
       ▼
 [Broker MQTT] (Mosquitto / EMQX)
       │ (Assinatura privada frutlog/+/telemetria)
       ▼
 [Ponte Privada Node.js]
       │ (HTTPS POST /api/iot/telemetria c/ X-IoT-Key)
       ▼
 [Backend API Node.js] (api/[...route].js)
       │ (PostgREST c/ Service Role)
       ▼
 [Banco de Dados Supabase / PostgreSQL] (Modelo Operacional Singular)
       ▲
       │ (Sessão JWT Bearer / HTTPS)
 [Frontend Web] (Dashboards Engenheiro, Técnico e Admin)
```

> [!IMPORTANT]
> O frontend nunca se conecta diretamente ao broker MQTT nem armazena chaves de serviço do banco. Toda a comunicação de IoT passa pela ponte privada autenticada.

---

## 💾 Banco de Dados Consolidado (Supabase)

O banco de dados foi unificado no **modelo operacional singular**. O esquema cria estrutura, restrições, índices, triggers, views e partições, mas não insere usuários, fazendas, talhões, sensores ou registros operacionais de exemplo:

📁 [`supabase/schema.sql`](supabase/schema.sql)

### Tabelas Principais
*   `organizacao`: Entidade gestora da propriedade.
*   `usuario`: Contas com perfis (`administrador`, `engenheiro`, `tecnico`) e senha com hash seguro PBKDF2.
*   `fazenda`: Propriedade rural vinculada à organização.
*   `talhao`: Talhões e geometrias cadastrados para cada fazenda.
*   `cultura` e `cultivar`: Espécies e variedades plantadas.
*   `ciclo_cultura`: Safras e ciclos ativos de plantio.
*   `dispositivo` e `sensor`: Hardwares e grandezas monitoradas (`temperatura`, `umidadeSolo`, `umidadeAr`, `chuva`).
*   `leitura_sensor`: Histórico de telemetria registrado.
*   `inspecao`, `ocorrencia`, `problema_sensor`: Registros operacionais de campo.
*   `colheita`: Histórico anual de produtividade.

---

## 🚀 Como Executar o Projeto

### 1. Configurar o Banco de Dados
1. Em uma instalação nova, abra o **SQL Editor** do Supabase e execute `supabase/schema.sql`.
2. Execute, na ordem, `supabase/006_particionamento_dinamico_telemetria.sql`, `supabase/007_admin_and_map_sync.sql`, `supabase/008_relatorios_diarios.sql`, `supabase/009_bootstrap_super_admin.sql`, `supabase/010_alertas_de_campo.sql`, `supabase/011_profissao_usuario.sql`, `supabase/012_bootstrap_admin_login.sql`, `supabase/015_reparar_esquema_operacional.sql`, `supabase/016_reparar_painel_engenheiro.sql` e `supabase/017_corrigir_codigo_ambiguo_talhoes.sql` para instalar particionamento de telemetria, sincronização de mapas, credenciais provisórias, relatórios diários, bootstrap inicial, alertas de campo, profissão no cadastro da equipe, matrícula `admin` e reparar as tabelas de colheitas, sensores, plantios, mapas e salvamento de geometrias.
3. Não execute importações legadas para inicializar uma instalação vazia. Em ambientes existentes, preserve e revise os dados antes de aplicar qualquer script de migração.

### 2. Configurar Variáveis de Ambiente
Copie o arquivo `.env.example` para `.env` e preencha as credenciais:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=sua-chave-service-role
JWT_SECRET=gere-uma-chave-aleatoria-com-pelo-menos-32-caracteres
IOT_API_KEY=gere-uma-chave-forte-para-os-dispositivos
FRONTEND_ORIGIN=http://localhost:5500
PORT=3000
BOOTSTRAP_ADMIN_PASSWORD=
THINGSPEAK_CHANNEL_ID=id-do-canal
THINGSPEAK_READ_API_KEY=chave-de-leitura-privada
THINGSPEAK_FIELD_TEMPERATURE=1
THINGSPEAK_FIELD_HUMIDITY=2
THINGSPEAK_FIELD_SOIL_HUMIDITY=3
THINGSPEAK_FIELD_RAINFALL=4
```

Preencha os valores ThingSpeak com o canal real do hardware e mantenha a chave de leitura apenas no `.env` do servidor. Os números de campo são ajustáveis caso o firmware publique métricas em outra ordem.

As senhas novas, temporárias ou alteradas devem possuir de 8 a 10 caracteres. Esta validação também é aplicada no endpoint de login; contas existentes com senhas maiores que 10 caracteres precisarão ter a credencial redefinida antes de adotar esta versão.

### 3. Iniciar o Servidor
No diretório do projeto, execute:

```powershell
npm start
```

O servidor iniciará em `http://localhost:3000` (com a API respondendo em `/api`).

---

## 🔐 Provisionar o primeiro administrador

O bootstrap inicial cria o Administrador Master com matrícula `admin`. Se `BOOTSTRAP_ADMIN_PASSWORD` estiver definida no `.env` local, o comando usa esse valor; caso contrário, gera uma senha aleatória de 10 caracteres. A senha é exibida apenas uma vez e deve possuir de 8 a 10 caracteres. Configure o `.env` e, após executar as migrações, rode:

```powershell
npm.cmd run bootstrap-admin
```

Guarde a senha mostrada no terminal. Ela não pode ser recuperada pelo banco e deverá ser alterada no primeiro acesso. O comando falha de forma explícita se já houver qualquer usuário no banco. Para usar uma senha de bootstrap definida pela operação, informe-a em `BOOTSTRAP_ADMIN_PASSWORD` somente no `.env` local (não versionado); mantenha a senha fora dos arquivos do repositório.

---

Se a matrícula `admin` já existir ou for necessário redefinir seu acesso, gere um hash com `npm.cmd run password-hash -- "senha-temporaria-de-8-a-10"`, substitua o marcador em [`supabase/013_reparar_admin.sql`](supabase/013_reparar_admin.sql) e execute o script no SQL Editor. O hash usa o mesmo PBKDF2 do backend; a senha será provisória e deverá ser alterada no primeiro login.

## 📡 Ingestão de telemetria IoT

A ponte IoT envia ao endpoint `/api/iot/telemetria` leituras reais de sensores previamente cadastrados. O corpo JSON contém `sensorId`, `talhao`, `tipo`, `valor` numérico e `unidade`; a requisição também precisa enviar a chave privada do servidor no cabeçalho `X-IoT-Key`.
---

## 🌐 Catálogo de Rotas da API (`/api`)

A API suporta tanto **endpoints granulares REST** (para consultas específicas de componentes) quanto **endpoints compostos BFF** (para carregamento veloz em uma única requisição):

### Autenticação, Saúde e IoT
| Método | Rota | Descrição | Autenticação |
|---|---|---|---|
| `GET` | `/api/health` | Verifica status da API e conexão ao banco. | Pública |
| `POST` | `/api/login` | Autentica matrícula/senha e emite token JWT. | Pública |
| `POST` | `/api/iot/telemetria` | Ingestão de leitura enviada pela ponte privada MQTT. | Header `X-IoT-Key` |
| `GET` | `/api/telemetria/thingspeak` | Proxy autenticado de leituras climáticas ThingSpeak; usa segredo somente no servidor. | Autenticado |
| `GET` | `/api/telemetria/diaria` | Histórico diário agregado de leituras por talhão. | Autenticado |

### Painéis Compostos (BFF)
| Método | Rota | Descrição | Perfil Permitido |
|---|---|---|---|
| `GET` | `/api/painel-engenheiro` | Retorna talhões, sensores, inspeções e tarefas agregadas. | Engenheiro, Admin |
| `GET` | `/api/painel-tecnico` | Retorna dados operacionais agregados para o técnico de campo. | Técnico, Admin |

### Rotas REST Granulares
| Método | Rota | Descrição | Perfil Permitido |
|---|---|---|---|
| `GET` | `/api/talhoes` | Lista todos os talhões cadastrados na fazenda. | Autenticado |
| `GET` | `/api/sensores` | Lista sensores de campo com status e última leitura. | Autenticado |
| `GET` / `POST` | `/api/inspecoes` | Consulta ou registra inspeção de rotina em talhão. | Técnico, Admin |
| `GET` / `POST` | `/api/ocorrencias` | Consulta ou reporta anomalia operacional. | Técnico, Admin |
| `GET` / `POST` | `/api/sensores/problemas` | Consulta ou registra chamado de manutenção em sensor. | Técnico, Admin |
| `GET` / `POST` | `/api/plantios` | Consulta ciclos ou cadastra novo plantio agrícola. | Engenheiro, Admin |
| `GET` | `/api/alertas` | Lista notificações ativas de limiares de sensores. | Autenticado |
| `GET` / `POST` | `/api/funcionarios` | Consulta equipe ou cadastra novo funcionário com perfil. | Admin |
