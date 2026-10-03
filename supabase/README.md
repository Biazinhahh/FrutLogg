# FrutLog — Banco de Dados Unificado (Modelo Operacional Singular)

Este diretório contém o esquema de dados oficial e consolidado do **FrutLog**, baseado no modelo operacional singular.

---

## 🚀 Como Executar no Supabase

1. Acesse o painel do seu projeto no [Supabase](https://supabase.com).
2. No menu lateral, clique em **SQL Editor**.
3. Crie uma nova consulta clicando em **+ New query**.
4. Execute `schema.sql` para criar a estrutura vazia.
5. Execute `006_particionamento_dinamico_telemetria.sql`, `007_admin_and_map_sync.sql`, `008_relatorios_diarios.sql`, `009_bootstrap_super_admin.sql`, `010_alertas_de_campo.sql`, `011_profissao_usuario.sql`, `012_bootstrap_admin_login.sql`, `015_reparar_esquema_operacional.sql`, `016_reparar_painel_engenheiro.sql` e `017_corrigir_codigo_ambiguo_talhoes.sql`, nessa ordem.
6. Configure `SUPABASE_URL` e a chave `service_role` apenas no `.env` local e execute `npm run bootstrap-admin` para criar o primeiro administrador.

O esquema não inclui usuários, talhões, sensores, credenciais ou leituras de exemplo.
O bootstrap só funciona enquanto não houver nenhum usuário e exige alteração da senha provisória no primeiro acesso.

Se o cadastro de funcionários retornar que `public.proxima_matricula_funcionario` não foi encontrada no cache do schema, execute `007_admin_and_map_sync.sql` no SQL Editor do Supabase. Essa migração cria a sequência e a função RPC de matrícula e solicita a atualização do cache do PostgREST; em seguida, tente o cadastro novamente.

Para reparar instalações existentes com colunas ou tabelas operacionais ausentes, execute `015_reparar_esquema_operacional.sql` no SQL Editor. A migração adiciona `talhao.coordenadas`, garante `colheita` e `problema_sensor`, preserva linhas existentes e atualiza o cache do PostgREST. Ela pressupõe que `schema.sql` e as migrações `006` a `012` já foram aplicadas.

Se o painel do engenheiro reportar que `ciclo_cultura.previsao_colheita` ou `relatorio_campo_diario` não existem, execute `016_reparar_painel_engenheiro.sql`. A migração é segura para reexecução e solicita a atualização do cache do PostgREST.

Se o salvamento dos limites dos talhões falhar com `column reference "codigo" is ambiguous`, execute `017_corrigir_codigo_ambiguo_talhoes.sql` no SQL Editor. Ela substitui a função RPC de salvamento sem alterar dados existentes; depois, tente salvar novamente.

### Recuperar ou redefinir o acesso de administrador

Se a matrícula `admin` já existir ou o bootstrap inicial não puder ser usado, gere localmente um hash compatível com o backend com `npm.cmd run password-hash -- "senha-temporaria-de-8-a-10"`. Substitua `COLE_AQUI_HASH_PBKDF2_GERADO_LOCALMENTE` em `013_reparar_admin.sql` pelo hash impresso e execute esse script no SQL Editor do Supabase. Ele garante as colunas `senha_temporaria` e `profissao`, cria ou atualiza a conta `admin`, marca a senha como provisória, garante uma organização e uma fazenda e solicita a atualização do cache da API. Não compartilhe nem armazene a senha em texto puro no SQL.

Se o administrador já foi provisionado e o login ainda retornar erro de banco sobre `senha_temporaria` ou `profissao`, execute apenas `014_reparar_colunas_usuario.sql`; esse ajuste não altera a senha da conta.

---

## 🏛️ Entidades e Tabelas Consolidadas

Todas as tabelas foram padronizadas no **singular**, com chaves primárias UUID e integridade referencial estrita:

| Tabela | Descrição |
|---|---|
| `organizacao` | Empresa/produtor titular do sistema. |
| `usuario` | Contas de acesso com controle de perfil (`administrador`, `engenheiro`, `tecnico`) e hash PBKDF2. |
| `fazenda` | Propriedade rural vinculada à organização. |
| `talhao` | Divisões físicas da fazenda cadastradas pela organização. |
| `cultura` | Culturas agrícolas cadastradas para os plantios reais. |
| `cultivar` | Variedades cadastradas para cada cultura. |
| `ciclo_cultura` | Registros de plantios e safras com datas de plantio, previsão de colheita e solo. |
| `dispositivo` | Hardwares e gateways de campo registrados pela organização. |
| `sensor` | Métricas monitoradas por dispositivo (`temperatura`, `umidadeSolo`, `umidadeAr`, `chuva`). |
| `leitura_sensor` | Histórico de telemetria coletado dos sensores via IoT/MQTT. |
| `inspecao` | Apontamentos de campo realizados pelo Técnico Agrícola. |
| `ocorrencia` | Registros de eventos ou anomalias operacionais. |
| `problema_sensor` | Ocorrências específicas de manutenção de sensores. |
| `regra_alerta` | Limiares configurados de temperatura, umidade e chuva. |
| `alerta` | Notificações ativas geradas por ultrapassagem de limiares ou falhas de sinal. |
| `colheita` | Histórico anual de produtividade e volume colhido. |
| `evento_auditoria` | Trilha de auditoria das ações administrativas. |

---

## 📊 Views Disponíveis

*   `v_ultima_leitura_sensor`: Retorna a leitura mais recente de cada sensor ativo.
*   `v_telemetria_diaria_talhao`: Agrega métricas diárias (média, mín, máx) por talhão.

---

## 🔒 Segurança (RLS e Autenticação)

*   **Row Level Security (RLS)** ativado em todas as tabelas.
*   Permissões de leitura/escrita concedidas exclusivamente à role `service_role` utilizada de forma segura pelo backend Node.js.
*   Credenciais nunca são expostas ao navegador.

---

## 📅 Particionamento de Telemetria (`leitura_sensor`)

Para alta performance no fluxo de IoT, a tabela `leitura_sensor` é particionada mensalmente por intervalo de tempo (`RANGE (coletado_em)`):

*   **Partição Padrão (`leitura_sensor_padrao`):** Evita que qualquer inserção falhe caso a data caia fora dos intervalos pré-definidos.
*   **Rotina Dinâmica:** A função `public.garantir_particao_leitura(data_alvo)` cria partições mensais sob demanda nomeadas como `leitura_sensor_YYYY_MM`.
*   **Criação em Lote:** A função `public.gerar_particoes_telemetria(meses_futuros)` pré-provisiona meses anteriores e futuros.
*   **Automação:** Agendada para execução mensal automática no dia 1º de cada mês via `pg_cron` (quando habilitado no Supabase).
