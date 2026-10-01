# Documentação técnica consolidada — FrutLog

> Estado analisado: outubro de 2026. Este documento descreve o código presente no repositório; interface e dados demonstrativos não são tratados como integração real.

## 1. Visão geral

O FrutLog é um protótipo web de gestão agrícola: organiza perfis, visualiza talhões, apresenta telemetria demonstrativa, permite preparar registros operacionais e oferece um chatbot de linha de comando separado. O público esperado é administrador, engenheiro agrônomo e técnico agrícola. O frontend é estático e ainda não há backend, banco de dados nem integração ativa com IoT/ThingSpeak no repositório.

## 2. Evolução e decisões

O projeto evoluiu para três painéis e uma estrutura temporária compartilhada de talhões (`js/talhoes.js`). O mapa deixou de depender do SVG codificado no fluxo do Engenheiro e do Técnico; continua usando SVG sobre imagem, não Leaflet. A arquitetura alvo é `ESP32 → ThingSpeak → backend → banco/API → frontend`, mas esse caminho não está implementado. O chatbot foi criado à parte em Python/Colab e não se integra aos painéis web.

## 3. Perfis

| Perfil | Responsabilidade | Estado/limitação |
|---|---|---|
| Administrador | Funcionários, perfis e sessões visualizadas | Parcial; dados locais e autorização apenas no navegador. |
| Engenheiro | Acompanhar talhões, cultivo, telemetria visual e editar geometria temporária | Parcial; cadastro e gravação dependem de backend. |
| Técnico | Consultar talhões, registrar inspeção, ocorrência e problema de sensor | Parcial; registros não são persistidos. |

O controle de rota é feito por `FrutLog.verificarSessao()` em `js/global.js`. Ele aceita os perfis `admin`, `engenheiro` e `tecnico`, mas não é RBAC seguro: em demonstração cria sessão no `sessionStorage`.

## 4. Arquitetura

**Atual:** HTML/CSS/JavaScript estático, dados locais, Chart.js por CDN e imagens locais. `apiFetch()` existe como adaptação futura, com base `http://localhost:3000/api`, mas a autenticação de API está desativada e nenhum backend está presente.

**Planejada:**

```text
ESP32 → ThingSpeak → Backend → Banco de dados → API → Frontend
```

Não há consulta direta ao ThingSpeak no frontend analisado.

## 5. IoT e 6. ThingSpeak

Há somente documentação/convenção da integração: Field 1 = temperatura, Field 2 = umidade e Field 3 = alerta de temperatura. Não foram encontrados ESP32, Channel ID, fields configurados, chaves, chamadas HTTP ao ThingSpeak ou código de leitura. Portanto IoT/ThingSpeak no FrutLog é **DEPENDENTE DO IoT E BACKEND**. Nenhuma credencial foi encontrada no frontend. O chatbot solicita a chave Groq em execução, sem gravá-la no arquivo.

## 7. Talhões e mapa

`js/talhoes.js` contém estrutura temporária em memória com `id`, `codigo`, `status`, cultura, variedade, área, solo, datas, sensor, leitura, prioridade e geometria como pares SVG. É equivalente conceitual simples a geometria, não GeoJSON. Engenheiro e Técnico consomem esse módulo na página carregada.

- Engenheiro: seleciona, cria uma geometria padrão, remove e ajusta vértices no modo “Editar Talhões”.
- Técnico: apenas seleciona/visualiza; não recebe controles de edição.
- Admin: possui ainda um mapa SVG estático de visão administrativa; isto é redundância agrícola e não editor.
- Persistência: **DEPENDENTE DO BACKEND**. Alterações não sobrevivem a recarga/navegação; o botão Salvar declara isso.

O roxo é somente classe `selecionado`; as classes verde/amarela/vermelha vêm do campo local `status`.

## 8. Divisão de talhões

O fluxo conceitual `A1 → A1.1/A1.2` está **PENDENTE**. O botão existe para explicitar a limitação: SVG nativo não implementa corte geométrico confiável e o código não cria divisão aproximada. Quando implementado com biblioteca/serviço apropriado, os filhos devem ter IDs, geometrias e registros próprios; o sensor original não pode ser duplicado automaticamente.

## 9. Cultivo, parâmetros e sensor

O formulário do Engenheiro possui produto, variedade, talhão, área, solo e datas. `js/talhoes.js` armazena cultura e associação de sensor temporárias. Não há campos de parâmetros de temperatura por cultivo/talhão, associação de sensores persistida ou CRUD real.

Relação desejada: `Talhão → Cultivo → Parâmetros → Sensor`. Estado atual: **PARCIAL**, limitado a dados de apresentação e formulário preparado para API.

## 10. Status e alertas

Estados visuais previstos: Normal, Atenção e Crítico. No código, o status é valor pré-definido nos dados locais; não é calculado com leitura de sensor e parâmetros. Não existe regra centralizada de limite/temperatura, nem alerta automático real. `tec.js` mostra alertas locais demonstrativos. Assim, cálculo de status e alertas automáticos são **PENDENTES/DEPENDENTES DO BACKEND E IoT**.

## 11. Engenheiro

| Função | Estado |
|---|---|
| Mapa e seleção | Implementado no frontend |
| Edição temporária de vértices/criação/exclusão | Parcial, sem persistência |
| Divisão real | Pendente |
| Cadastro de cultivo | Dependente do backend |
| Telemetria, histórico e gráfico de colheita | Parcial; dados locais demonstrativos |
| Parâmetros por cultivo e vínculo de sensor | Pendente |

## 12. Técnico

O Técnico vê mapa, status local, cultura, área, sensor/leitura local, tarefas, sensores e alertas. O formulário de inspeção acrescenta item apenas ao array em memória da página; ocorrências e problemas de sensor apenas registram intenção no console/mensagem. Nenhum formulário altera talhão, geometria, parâmetro ou associação estrutural de sensor. Persistência de todos esses registros é **DEPENDENTE DO BACKEND**.

## 13. Administrador

`admin.html`/`js/admin.js` oferecem formulário de funcionário, matrícula incremental local, tabela de sessões locais e gráficos locais. O envio está comentado para API futura. Redundâncias: mapa de talhões, indicadores de colheita e clima exibem informações agrícolas; permanecem para não remover funcionalidade sem decisão de produto. Não há gestão real de usuários, permissões ou auditoria.

## 14. Autenticação e segurança

`login.js` valida campos no cliente e o modo demonstração cria sessão com perfil escolhido. `global.js` armazena sessão e token em `sessionStorage`; autenticação remota está desligada. Isso é **inseguro para produção**: o cliente controla perfil e proteção de rota. Não foram encontrados segredos no frontend. A chave da Groq é solicitada por `getpass`, porém o chatbot imprime mensagens de erro da API no console e deve ser executado em ambiente protegido.

## 15. Backend, API e 16. Banco de dados

Não há código de backend, modelo, migração ou banco no repositório. `apiFetch()` é infraestrutura genérica. O README lista rotas previstas (`/login`, `/talhoes`, `/plantios`, `/inspecoes`, `/ocorrencias`, `/sensores`, `/funcionarios` e outras), mas elas são **PLANEJADAS**, não endpoints existentes.

Modelo planejado, não implementado: Usuário, Talhão, Cultivo, Parâmetro, Sensor, Leitura, Inspeção, Ocorrência e Colheita. Os relacionamentos e validações devem ficar no backend/banco.

## 17. Frontend

| Área | Arquivos principais |
|---|---|
| Entrada e login | `index.html`, `login.html`, `js/index.js`, `js/login.js` |
| Sessão/API futura | `js/global.js` |
| Engenheiro | `eng.html`, `js/eng.js`, `css/eng.css` |
| Técnico | `tec.html`, `js/tec.js`, `css/tec.css` |
| Admin | `admin.html`, `js/admin.js`, `css/admin.css` |
| Componentes comuns | `css/global.css`, `css/dashboard.css`, `js/talhoes.js` |

Há responsividade CSS e gráficos Chart.js carregados por CDN. O teste `frutlog-smoke.spec.js` é Playwright, mas não há `package.json` nem dependências instaladas no repositório.

## 18. Telemetria, 19. alertas, 20. inspeções e ocorrências

Temperatura, umidade do ar, umidade do solo, chuva, telemetria mensal e colheita aparecem em `eng.js` como dados demonstrativos. Não há atualização, histórico real ou origem ThingSpeak. Alertas do Técnico também são locais. Inspeção, ocorrência e problema de sensor têm formulários e pontos de integração comentados, mas não gravação real. Inspeção operacional não é usada para calcular o status automático — este cálculo sequer está implementado.

## 21. Histórico e relatórios

Existem telas/tabelas de histórico mensal, colheita anual e inspeções. Seus conteúdos são demonstrativos ou temporários. `README.md` e `RELATORIO_FRUTLOG.md` são documentação prévia; ambos antecipam integrações ainda inexistentes.

## 22. Chatbot e 23. base de conhecimento

`chatboot/chatboot.py` é um script interativo voltado a Colab (contém `! pip`), usa SDK Groq e modelo `openai/gpt-oss-20b`. Carrega externamente `frutlog_base_compacta_llm.json`, arquivo que não está no repositório; portanto o chatbot não executa sem essa base. A recuperação é por palavras-chave em registros `{p, r}`, usa no máximo cinco resultados e seis mensagens recentes. O prompt proíbe invenções e exposição de segredos. Não há autenticação, perfil de usuário nem integração do chatbot à base transacional/painéis.

## 24. Regras de negócio: local de implementação

| Regra | Situação/local |
|---|---|
| Rota por perfil | `js/global.js`; cliente, não segura em produção |
| Seleção ≠ status | CSS e renderização do mapa |
| Edição só Engenheiro | Controles apenas em `eng.html/js/eng.js` |
| Sensor não duplicar após divisão | Regra documentada; divisão ainda não implementada |
| Status por leitura + parâmetros | Pendente; não há regra implementada |
| Registros de campo | Formulários em `tec.js`; persistência pendente |

## 25. Fluxo completo

O fluxo efetivo é `Login demonstrativo → sessão no navegador → painel por perfil → dados locais/formulários`. O fluxo alvo é `Usuário → login/autorização → talhão → cultivo/parâmetros → sensor → ThingSpeak → backend → status/alerta → técnico → inspeção/ocorrência → histórico` e depende de backend e IoT.

## 26. Tecnologias encontradas

HTML5, CSS3, JavaScript browser, SVG, Chart.js (CDN), Font Awesome (CDN), Playwright (especificação de smoke test), Python, Groq SDK e modelo `openai/gpt-oss-20b`. Não foram encontrados Leaflet, Leaflet-Geoman, Node backend, API REST ativa, banco de dados, ESP32 ou código ThingSpeak.

## 27. Estado atual

| Funcionalidade | Estado | Observação |
|---|---|---|
| Login | Parcial | Demonstração no cliente |
| Admin | Parcial | Dados e cadastro locais |
| Engenheiro | Parcial | Mapa/telemetria visual; sem backend |
| Técnico | Parcial | Formulários sem persistência |
| Mapa | Parcial | SVG e geometria em memória |
| Divisão de talhões | Pendente | Sem corte geométrico |
| Cultivo | Dependente do backend | Interface preparada |
| IoT/ThingSpeak | Dependente do IoT/backend | Sem código de consumo |
| Telemetria | Parcial | Dados demonstrativos |
| Status automático | Pendente | Valor fixo local |
| Alertas automáticos | Pendente | Alertas locais demonstrativos |
| Inspeções/ocorrências | Dependente do backend | UI preparada |
| Histórico | Parcial | Dados locais |
| Backend/banco | Pendente | Não presentes |
| Chatbot | Parcial | Script separado e base ausente |

## 28. Problemas e pendências

- Não há backend, banco, integração ThingSpeak nem cálculo centralizado de status.
- Dados demonstrativos estão duplicados entre `eng.js`, `tec.js`, `admin.js` e parcialmente centralizados em `talhoes.js`.
- O Técnico recria a lista de talhões na carga, portanto não vê edições temporárias de outra página.
- Divisão real e persistência geográfica não existem.
- O Admin conserva redundâncias agrícolas.
- Autorização no frontend é contornável; não há validação de perfil no servidor.
- O mapa estático antigo ainda existe no HTML do Técnico/Admin embora o fluxo do Técnico o substitua em runtime.
- O chatbot depende de arquivo JSON ausente e seu arquivo `.py` usa sintaxe de notebook/Colab.

## 29. Próximos passos

1. Definir e implementar backend autenticado, banco e RBAC no servidor.
2. Integrar backend ao ThingSpeak usando credenciais apenas no servidor e manter os três fields conhecidos.
3. Persistir talhões/cultivos/parâmetros/sensores e implementar cálculo de status no backend.
4. Escolher solução de geoprocessamento para divisão real de polígonos.
5. Substituir os dados demonstrativos por leituras e históricos reais.
6. Implementar alertas automáticos e persistir registros do Técnico.
7. Instalar/configurar ambiente de testes e ampliar Playwright.
8. Integrar chatbot com autenticação/contexto permitido e fornecer a base sem credenciais.

## 30. Conclusão

O FrutLog é uma boa base de interface e fluxo de perfis, não um sistema agrícola integrado pronto para produção. Mapa, seleção, formulários e visualizações existem no frontend; autenticação, persistência, IoT, status automático, alertas e divisão correta dos talhões ainda exigem implementação de backend e integração técnica.
