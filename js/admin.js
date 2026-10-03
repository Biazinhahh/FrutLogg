/* =========================================================
   FRUTLOG - ADMINISTRADOR
   Gestao de usuarios, sensores, talhoes e operacao de campo.
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {
  FrutLog.verificarSessao(["admin"]);
  FrutLog.configurarLogout();
  FrutLog.configurarAbasSidebar();
  configurarFormularioFuncionario();
  configurarFormularioSensor();
  configurarFiltrosFuncionarios();
  configurarAcoesTabelas();
  configurarGraficos();
  preencherSelectTalhoes();
  window.addEventListener("frutlog:colheitas-atualizadas", async () => {
    try {
      const resposta = await FrutLog.apiFetch("/colheitas/anual");
      definirColheitasAnuais(resposta.colheitas);
      renderizarGraficoColheita();
    } catch (erro) {
      exibirMensagem("mensagem-colheita-admin", erro.message, "erro");
    }
  });
  window.addEventListener("frutlog:talhoes-atualizados", atualizarDadosCampoConectados);
  try {
    await carregarDadosConectados();
  } catch (erro) {
    exibirMensagem("mensagem-carregamento-admin", `Falha ao carregar os dados: ${erro.message}`, "erro");
  }
});

let funcionarios = [];
let sensores = [];
let colheitasAnuais = [];
let painelTecnico = {
  talhoes: [],
  inspecoes: [],
  plantios: [],
  ocorrencias: [],
  problemasSensores: [],
  tarefas: [],
  alertas: [],
};
let graficoColheita = null;
let graficoLeituras = null;
let unidadeColheita = "t";
let telemetriaDiariaAdmin = [];

function escaparHtml(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[caractere]);
}

function formatarData(valor) {
  if (!valor) return "--";
  const dataISO = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dataISO) return `${dataISO[3]}/${dataISO[2]}/${dataISO[1]}`;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return escaparHtml(valor);
  return new Intl.DateTimeFormat("pt-BR").format(data);
}

function exibirMensagem(id, texto, tipo = "") {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.className = `mensagem-feedback ${tipo}`.trim();
}

function mostrarLinhasVazias(id, colunas, texto = "Nenhum registro encontrado.") {
  const tabela = document.getElementById(id);
  if (tabela) tabela.innerHTML = `<tr><td colspan="${colunas}">${escaparHtml(texto)}</td></tr>`;
}

function gerarSenhaTemporaria() {
  const caracteres = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  const limiteSemVies = 256 - (256 % caracteres.length);
  let senha = "";
  while (senha.length < 10) {
    const bytes = window.crypto.getRandomValues(new Uint8Array(16));
    for (const byte of bytes) {
      if (byte < limiteSemVies) senha += caracteres[byte % caracteres.length];
      if (senha.length === 10) break;
    }
  }
  return senha;
}

function configurarFormularioFuncionario() {
  const formulario = document.getElementById("form-funcionario");
  const campoId = document.getElementById("funcionario-id");
  const campoMatricula = document.getElementById("funcionario-matricula");
  const campoSenha = document.getElementById("funcionario-senha");
  const botaoGerarSenha = document.getElementById("btn-gerar-senha");
  const botaoMostrarSenha = document.getElementById("btn-mostrar-senha");
  const botaoCopiarSenha = document.getElementById("btn-copiar-senha");
  const botaoSalvar = document.getElementById("btn-salvar-funcionario");
  const botaoCancelar = document.getElementById("btn-cancelar-edicao-funcionario");

  if (campoMatricula) {
    campoMatricula.value = "Gerada ao cadastrar";
    campoMatricula.required = false;
  }
  if (campoSenha) {
    campoSenha.value = gerarSenhaTemporaria();
    campoSenha.type = "text";
  }
  botaoGerarSenha?.addEventListener("click", () => {
    if (campoSenha) campoSenha.value = gerarSenhaTemporaria();
  });
  botaoMostrarSenha?.addEventListener("click", () => {
    const mostrar = campoSenha.type === "password";
    campoSenha.type = mostrar ? "text" : "password";
    botaoMostrarSenha.textContent = mostrar ? "Ocultar senha" : "Mostrar senha";
  });
  botaoCopiarSenha?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(campoSenha.value);
      exibirMensagem("mensagem-funcionario", "Senha provisoria copiada.", "sucesso");
    } catch (erro) {
      exibirMensagem("mensagem-funcionario", `Nao foi possivel copiar a senha: ${erro.message}`, "erro");
    }
  });
  botaoCancelar?.addEventListener("click", () => {
    formulario.reset();
    campoId.value = "";
    campoMatricula.value = "Gerada ao cadastrar";
    campoSenha.required = true;
    campoSenha.type = "text";
    botaoMostrarSenha.textContent = "Ocultar senha";
    campoSenha.placeholder = "8 a 10 caracteres";
    campoSenha.value = gerarSenhaTemporaria();
    botaoCancelar.hidden = true;
    botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
    exibirMensagem("mensagem-funcionario", "");
  });

  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const mensagemId = "mensagem-funcionario";

    const editando = Boolean(dados.id);
    const senhaProvisoriaUsada = dados.senha;
    if ((!editando || dados.senha) && (typeof dados.senha !== "string" || dados.senha.length < 8 || dados.senha.length > 10)) {
      exibirMensagem(mensagemId, "A senha provisoria deve possuir entre 8 e 10 caracteres.", "erro");
      campoSenha?.focus();
      return;
    }

    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;
    try {
      const payload = {
          nome: dados.nome,
          cargo: dados.cargo,
          profissao: dados.profissao,
          perfil: dados.perfil,
          status: dados.status,
      };
      if (dados.senha) payload.senha = dados.senha;
      if (editando) {
        await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(dados.id)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        funcionarios = funcionarios.map((item) => String(item.id) === String(dados.id)
          ? { ...item, ...payload, ativo: payload.status === "ativo" }
          : item);
        exibirMensagem(mensagemId, "Funcionario atualizado.", "sucesso");
      } else {
        const resposta = await FrutLog.apiFetch("/funcionarios", {
          method: "POST",
          body: JSON.stringify({ ...payload, senha: dados.senha }),
        });
        const novoFuncionario = {
          id: resposta.id,
          matricula: resposta.matricula,
          nome: dados.nome,
          cargo: dados.cargo,
          profissao: dados.profissao,
          perfil: dados.perfil,
          ativo: dados.status === "ativo",
        };
        funcionarios.push(novoFuncionario);
        exibirMensagem(mensagemId, `Funcionario cadastrado. Matricula: ${novoFuncionario.matricula}. A senha devera ser alterada no primeiro acesso.`, "sucesso");
      }
      renderizarFuncionarios();
      formulario.reset();
      campoId.value = "";
      campoMatricula.value = "Gerada ao cadastrar";
      campoSenha.required = true;
      campoSenha.placeholder = "8 a 10 caracteres";
      campoSenha.value = editando ? gerarSenhaTemporaria() : senhaProvisoriaUsada;
      campoSenha.type = "text";
      botaoMostrarSenha.textContent = "Ocultar senha";
      botaoCancelar.hidden = true;
      botaoSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Cadastrar Funcionario';
      if (!editando) {
        exibirMensagem(mensagemId, "Funcionario cadastrado. A senha provisoria usada continua visivel abaixo para ser copiada; o funcionario devera altera-la no primeiro acesso.", "sucesso");
      }
    } catch (erro) {
      exibirMensagem(mensagemId, erro.message, "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function carregarFuncionarios() {
  const tabela = document.getElementById("tabela-funcionarios");
  if (!tabela) return;
  const termo = document.getElementById("filtro-funcionarios")?.value.trim().toLocaleLowerCase("pt-BR") || "";
  const statusFiltro = document.getElementById("filtro-status-funcionarios")?.value || "todos";
  const filtrados = funcionarios.filter((funcionario) => {
    const ativo = typeof funcionario.ativo === "boolean" ? funcionario.ativo : funcionario.status === "ativo";
    const combinaStatus = statusFiltro === "todos" || (statusFiltro === "ativo" ? ativo : !ativo);
    const texto = [funcionario.matricula, funcionario.nome, funcionario.cargo, funcionario.profissao, funcionario.perfil]
      .join(" ").toLocaleLowerCase("pt-BR");
    return combinaStatus && texto.includes(termo);
  });

  if (!filtrados.length) {
    mostrarLinhasVazias("tabela-funcionarios", 7);
    return;
  }

  tabela.innerHTML = filtrados.map((funcionario) => {
    const ativo = typeof funcionario.ativo === "boolean" ? funcionario.ativo : funcionario.status === "ativo";
    return `
      <tr>
        <td>${escaparHtml(funcionario.matricula)}</td>
        <td>${escaparHtml(funcionario.nome)}</td>
        <td>${escaparHtml(funcionario.cargo)}</td>
        <td>${escaparHtml(funcionario.profissao || "--")}</td>
        <td>${escaparHtml(funcionario.perfil)}</td>
        <td><span class="badge-status ${ativo ? "normal" : "inativo"}">${ativo ? "Ativo" : "Inativo"}</span></td>
        <td>
          <button class="btn-acao-admin" type="button" data-editar-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""} aria-label="Editar ${escaparHtml(funcionario.nome)}">Editar</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-funcionario="${escaparHtml(funcionario.id)}" ${String(funcionario.id) === String(FrutLog.obterSessao()?.id) ? "disabled" : ""} aria-label="Excluir ${escaparHtml(funcionario.nome)}">Excluir</button>
        </td>
      </tr>`;
  }).join("");
}

function configurarFiltrosFuncionarios() {
  document.getElementById("filtro-funcionarios")?.addEventListener("input", carregarFuncionarios);
  document.getElementById("filtro-status-funcionarios")?.addEventListener("change", carregarFuncionarios);
}

function configurarAcoesTabelas() {
  document.getElementById("tabela-funcionarios")?.addEventListener("click", async (evento) => {
    const botaoEditar = evento.target.closest("[data-editar-funcionario]");
    if (botaoEditar) {
      const funcionario = funcionarios.find((item) => String(item.id) === botaoEditar.dataset.editarFuncionario);
      if (!funcionario) return;
      document.getElementById("funcionario-id").value = funcionario.id;
      document.getElementById("funcionario-matricula").value = funcionario.matricula;
      document.getElementById("funcionario-nome").value = funcionario.nome;
      document.getElementById("funcionario-cargo").value = funcionario.cargo;
      document.getElementById("funcionario-profissao").value = funcionario.profissao || "";
      document.getElementById("funcionario-perfil").value = funcionario.perfil;
      document.getElementById("funcionario-status").value = funcionario.ativo ? "ativo" : "inativo";
      document.getElementById("funcionario-senha").value = "";
      document.getElementById("funcionario-senha").required = false;
      document.getElementById("funcionario-senha").type = "text";
      document.getElementById("btn-mostrar-senha").textContent = "Ocultar senha";
      document.getElementById("funcionario-senha").placeholder = "Deixe vazio para manter a senha atual";
      document.getElementById("btn-cancelar-edicao-funcionario").hidden = false;
      document.getElementById("btn-salvar-funcionario").innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar Alteracoes';
      exibirMensagem("mensagem-funcionario", "Opcionalmente, defina uma nova senha provisoria; o funcionario precisara troca-la no proximo acesso.");
      document.getElementById("form-funcionario").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const botao = evento.target.closest("[data-excluir-funcionario]");
    if (!botao) return;
    const id = botao.dataset.excluirFuncionario;
    const funcionario = funcionarios.find((item) => String(item.id) === String(id));
    if (!funcionario || !window.confirm(`Excluir ${funcionario.nome} do sistema? Esta acao nao pode ser desfeita.`)) return;

    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/funcionarios/${encodeURIComponent(id)}`, { method: "DELETE" });
      funcionarios = funcionarios.filter((item) => String(item.id) !== String(id));
      renderizarFuncionarios();
      exibirMensagem("mensagem-funcionario", "Funcionario excluido.", "sucesso");
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-funcionario", erro.message, "erro");
    }
  });

  document.getElementById("tabela-sensores-admin")?.addEventListener("click", async (evento) => {
    const botaoAlternar = evento.target.closest("[data-alternar-sensor]");
    if (botaoAlternar) {
      const id = botaoAlternar.dataset.alternarSensor;
      const sensor = sensores.find((item) => String(item.id) === String(id));
      if (!sensor) return;
      botaoAlternar.disabled = true;
      try {
        await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, {
          method: "PATCH",
          body: JSON.stringify({ status: sensor.ativo ? "inativo" : "ativo" }),
        });
        const resposta = await FrutLog.apiFetch("/sensores");
        sensores = resposta.sensores || [];
        renderizarSensores();
        renderizarGraficoLeituras();
        exibirMensagem("mensagem-sensor", `Sensor ${sensor.ativo ? "desativado" : "ativado"}.`, "sucesso");
      } catch (erro) {
        botaoAlternar.disabled = false;
        exibirMensagem("mensagem-sensor", erro.message, "erro");
      }
      return;
    }
    const botao = evento.target.closest("[data-excluir-sensor]");
    if (!botao) return;
    const id = botao.dataset.excluirSensor;
    const sensor = sensores.find((item) => String(item.id) === String(id));
    if (!sensor || !window.confirm(`Excluir o sensor ${sensor.sensor}? O historico de leituras associado tambem sera apagado.`)) return;

    botao.disabled = true;
    try {
      await FrutLog.apiFetch(`/sensores/${encodeURIComponent(id)}`, { method: "DELETE" });
      sensores = sensores.filter((item) => String(item.id) !== String(id));
      renderizarSensores();
      renderizarGraficoLeituras();
      exibirMensagem("mensagem-sensor", "Sensor e leituras historicas associadas excluidos.", "sucesso");
    } catch (erro) {
      botao.disabled = false;
      exibirMensagem("mensagem-sensor", erro.message, "erro");
    }
  });
}

function configurarFormularioSensor() {
  const formulario = document.getElementById("form-sensor");
  formulario?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const dados = Object.fromEntries(new FormData(formulario));
    const botao = formulario.querySelector('[type="submit"]');
    if (botao) botao.disabled = true;

    try {
      const resposta = await FrutLog.apiFetch("/sensores", {
        method: "POST",
        body: JSON.stringify(dados),
      });
      const sensor = {
        ...resposta.sensor,
        sensor: resposta.sensor.id_externo,
        id: resposta.sensor.id,
        talhao: dados.talhao,
        tipo: dados.tipo,
        unidade: dados.unidade,
        leitura: "Sem leitura",
        valor: null,
        status: "Offline",
        ativo: true,
      };
      sensores.push(sensor);
      renderizarSensores();
      renderizarGraficoLeituras();
      preencherSelectTalhoes();
      exibirMensagem("mensagem-sensor", `Sensor ${sensor.sensor} cadastrado.`, "sucesso");
      formulario.reset();
    } catch (erro) {
      exibirMensagem("mensagem-sensor", erro.message, "erro");
    } finally {
      if (botao) botao.disabled = false;
    }
  });
}

function normalizarStatus(valor) {
  return String(valor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function renderizarFuncionarios() {
  carregarFuncionarios();
}

function preencherSelectTalhoes() {
  const select = document.getElementById("sensor-talhao");
  if (!select) return;
  const selecionado = select.value;
  const codigos = (window.FrutLogTalhoes?.obterTalhoes() || [])
    .map((feature) => feature.properties.codigo);
  for (const talhao of painelTecnico.talhoes || []) {
    if (talhao.id && !codigos.includes(talhao.id)) codigos.push(talhao.id);
  }
  select.innerHTML = '<option value="">Selecione o talhao</option>' + codigos
    .map((codigo) => `<option value="${escaparHtml(codigo)}">${escaparHtml(codigo)}</option>`)
    .join("");
  if (codigos.includes(selecionado)) select.value = selecionado;
}

function renderizarSensores() {
  const tabela = document.getElementById("tabela-sensores-admin");
  if (!tabela) return;
  if (!sensores.length) {
    mostrarLinhasVazias("tabela-sensores-admin", 6);
    return;
  }

  tabela.innerHTML = sensores.map((sensor) => {
    const status = sensor.status || (sensor.ativo === false ? "Inativo" : "Online");
    const statusClasse = normalizarStatus(status);
    return `
      <tr>
        <td>${escaparHtml(sensor.sensor || sensor.id_externo)}</td>
        <td>${escaparHtml(sensor.talhao || "--")}</td>
        <td>${escaparHtml(sensor.tipo || sensor.codigo_metrica)}</td>
        <td>${escaparHtml(sensor.leitura || "Sem leitura")}</td>
        <td><span class="badge-status ${statusClasse}">${escaparHtml(status)}</span></td>
        <td>
          <button class="btn-acao-admin" type="button" data-alternar-sensor="${escaparHtml(sensor.id)}" aria-label="${sensor.ativo ? "Desativar" : "Ativar"} sensor ${escaparHtml(sensor.sensor || sensor.id_externo)}">${sensor.ativo ? "Desativar" : "Ativar"}</button>
          <button class="btn-acao-admin btn-excluir-admin" type="button" data-excluir-sensor="${escaparHtml(sensor.id)}" aria-label="Excluir sensor ${escaparHtml(sensor.sensor || sensor.id_externo)}">Excluir</button>
        </td>
      </tr>`;
  }).join("");
}

function preencherTabela(id, colunas, linhas) {
  const tabela = document.getElementById(id);
  if (!tabela) return;
  if (!linhas.length) {
    mostrarLinhasVazias(id, colunas);
    return;
  }
  tabela.innerHTML = linhas.join("");
}

function renderizarPainelTecnico() {
  const talhoes = painelTecnico.talhoes || [];
  const inspecoes = painelTecnico.inspecoes || [];
  const plantios = painelTecnico.plantios || [];
  const ocorrencias = painelTecnico.ocorrencias || [];
  const problemas = painelTecnico.problemasSensores || painelTecnico.problemas_sensores || [];
  const tarefas = painelTecnico.tarefas || [];
  const alertas = painelTecnico.alertas || [];

  document.getElementById("resumo-total-talhoes").textContent = talhoes.length;
  document.getElementById("resumo-total-sensores").textContent = sensores.length || (painelTecnico.sensores || []).length;
  document.getElementById("resumo-total-inspecoes").textContent = inspecoes.length;
  document.getElementById("resumo-total-tarefas").textContent = tarefas.length;
  document.getElementById("resumo-total-alertas").textContent = alertas.length;

  preencherTabela("tabela-talhoes-admin", 7, talhoes.map((talhao) => `
    <tr>
      <td>${escaparHtml(talhao.id || talhao.talhao)}</td>
      <td>${escaparHtml(talhao.cultura || talhao.produto || "--")}</td>
      <td>${escaparHtml(talhao.area || "--")}</td>
      <td>${escaparHtml(talhao.sensor || "--")}</td>
      <td>${escaparHtml(talhao.leitura || "--")}</td>
      <td><span class="badge-status ${normalizarStatus(talhao.situacao || talhao.status)}">${escaparHtml(talhao.situacao || talhao.status || "--")}</span></td>
      <td>${escaparHtml(talhao.prioridade || "--")}</td>
    </tr>`));
  preencherTabela("tabela-inspecoes-admin", 5, inspecoes.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.talhao)}</td>
      <td><span class="badge-status ${normalizarStatus(item.situacao)}">${escaparHtml(item.situacao)}</span></td>
      <td>${escaparHtml(item.problemas || "Sem ocorrencia")}</td><td>${escaparHtml(item.observacoes || "--")}</td></tr>`));
  preencherTabela("tabela-plantios-admin", 5, plantios.map((item) => `
    <tr><td>${escaparHtml(item.talhao || item.talhao_id || "--")}</td>
      <td>${escaparHtml([item.produto || item.cultura, item.variedade].filter(Boolean).join(" / ") || "--")}</td>
      <td>${escaparHtml(item.area ?? item.area_plantada_hectares ?? "--")}</td>
      <td>${formatarData(item.dataPlantio || item.plantado_em)}</td>
      <td>${formatarData(item.dataColheita || item.previsao_colheita)}</td></tr>`));
  preencherTabela("tabela-ocorrencias-admin", 4, ocorrencias.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.talhao)}</td>
      <td>${escaparHtml(item.tipo)}</td><td>${escaparHtml(item.observacao || "--")}</td></tr>`));
  preencherTabela("tabela-problemas-admin", 5, problemas.map((item) => `
    <tr><td>${formatarData(item.data)}</td><td>${escaparHtml(item.sensor || "--")}</td>
      <td>${escaparHtml(item.talhao || "--")}</td><td>${escaparHtml(item.problema)}</td>
      <td>${escaparHtml(item.observacao || "--")}</td></tr>`));

  const linhasAlertas = [
    ...tarefas.map((item) => `<tr><td>${escaparHtml(item.talhao || "--")}</td><td>${escaparHtml(item.prioridade || "Tarefa")}</td><td>${escaparHtml(item.atividade || "--")}</td><td>Pendente</td></tr>`),
    ...alertas.map((item) => `<tr><td>${escaparHtml(item.titulo || item.talhao || "--")}</td><td>${escaparHtml(item.severidade || item.nivel || "--")}</td><td>${escaparHtml(item.mensagem || item.texto || item.titulo || "--")}</td><td>${escaparHtml(item.status || "Aberto")}</td></tr>`),
  ];
  preencherTabela("tabela-alertas-admin", 4, linhasAlertas);
  preencherSelectTalhoes();
}

function renderizarMapaAdmin() {
  const mapa = document.getElementById("mapa-talhoes-admin");
  if (!mapa || !window.FrutLogTalhoes) return;
  const features = FrutLogTalhoes.obterTalhoes();
  const estados = new Map((painelTecnico.talhoes || []).map((item) => [item.id, item.situacao || item.status]));
  mapa.replaceChildren();
  features.forEach((feature) => {
    const codigo = feature.properties.codigo;
    const poligono = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poligono.setAttribute("points", FrutLogTalhoes.obterPontos(feature).map((ponto) => ponto.join(",")).join(" "));
    poligono.dataset.talhao = codigo;
    poligono.classList.add("talhao-mapa", `status-${normalizarStatus(estados.get(codigo) || feature.properties.status)}`);
    poligono.setAttribute("tabindex", "0");
    poligono.setAttribute("role", "button");
    poligono.setAttribute("aria-label", `Talhao ${codigo}`);
    const selecionar = () => {
      mapa.querySelectorAll(".talhao-mapa").forEach((item) => item.classList.toggle("selecionado", item === poligono));
      const dados = (painelTecnico.talhoes || []).find((item) => item.id === codigo);
      exibirMensagem("mensagem-dados-tecnicos", dados
        ? `Talhao ${codigo}: ${dados.situacao || "sem situacao"}; leitura ${dados.leitura || "indisponivel"}.`
        : `Talhao ${codigo} selecionado.`);
    };
    poligono.addEventListener("click", selecionar);
    poligono.addEventListener("keydown", (evento) => {
      if (evento.key === "Enter" || evento.key === " ") {
        evento.preventDefault();
        selecionar();
      }
    });
    mapa.appendChild(poligono);
  });
}

function renderizarTelemetriaDiariaAdmin() {
  const metricas = {
    temperatura: "Temperatura",
    umidadeAr: "Umidade do ar",
    umidadeSolo: "Umidade do solo",
    chuva: "Chuva",
  };
  preencherTabela("tabela-telemetria-admin", 7, telemetriaDiariaAdmin.map((item) => `
    <tr>
      <td>${formatarData(item.dia)}</td>
      <td>${escaparHtml(item.talhao || "--")}</td>
      <td>${escaparHtml(metricas[item.codigo_metrica] || item.codigo_metrica)}</td>
      <td>${escaparHtml(item.valor_medio)}</td>
      <td>${escaparHtml(item.valor_minimo)}</td>
      <td>${escaparHtml(item.valor_maximo)}</td>
      <td>${escaparHtml(item.leituras_contabilizadas)}</td>
    </tr>
  `));
}

function configurarGraficos() {
  document.querySelectorAll("[data-unidade-admin]").forEach((botao) => {
    botao.addEventListener("click", () => {
      unidadeColheita = botao.dataset.unidadeAdmin;
      document.querySelectorAll("[data-unidade-admin]").forEach((item) => item.classList.toggle("active", item === botao));
      renderizarGraficoColheita();
    });
  });
}

function definirColheitasAnuais(colheitas) {
  colheitasAnuais = Array.isArray(colheitas) ? colheitas : [];
  if (colheitasAnuais.length && !colheitasAnuais.some((item) => item.unidade === unidadeColheita)) {
    unidadeColheita = colheitasAnuais[0].unidade;
    document.querySelectorAll("[data-unidade-admin]").forEach((botao) => {
      botao.classList.toggle("active", botao.dataset.unidadeAdmin === unidadeColheita);
    });
  }
}

function renderizarGraficoColheita() {
  const canvas = document.getElementById("grafico-colheita-anual");
  if (!canvas || typeof Chart === "undefined") return;
  if (graficoColheita) graficoColheita.destroy();
  const dados = colheitasAnuais.filter((item) => item.unidade === unidadeColheita);
  const unidadeLabel = { t: "Toneladas", sc: "Sacas", kg: "Quilogramas", cx: "Caixas" };
  const unidade = unidadeLabel[unidadeColheita] || unidadeColheita;
  const mensagem = document.getElementById("mensagem-colheita-admin");
  if (!dados.length) {
    graficoColheita = null;
    if (mensagem) mensagem.textContent = "Ainda nao ha registros de colheita para esta unidade.";
    ["resumo-colheita-ultima", "resumo-colheita-menor", "resumo-colheita-maior"].forEach((id) => {
      document.getElementById(id).textContent = "--";
    });
    return;
  }
  if (mensagem) mensagem.textContent = "";

  graficoColheita = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map((item) => item.ano),
      datasets: [{
        label: unidade[0].toUpperCase() + unidade.slice(1),
        data: dados.map((item) => item.quantidade),
        backgroundColor: "#2e7d32",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });

  const menor = dados.reduce((a, b) => a.quantidade < b.quantidade ? a : b);
  const maior = dados.reduce((a, b) => a.quantidade > b.quantidade ? a : b);
  const ultima = dados.reduce((a, b) => a.ano > b.ano ? a : b);
  document.getElementById("resumo-colheita-ultima").textContent = `${ultima.ano}: ${ultima.quantidade} ${unidade}`;
  document.getElementById("resumo-colheita-menor").textContent = `${menor.ano}: ${menor.quantidade} ${unidade}`;
  document.getElementById("resumo-colheita-maior").textContent = `${maior.ano}: ${maior.quantidade} ${unidade}`;
}

function renderizarGraficoLeituras() {
  const canvas = document.getElementById("grafico-leituras-sensores");
  if (!canvas || typeof Chart === "undefined") return;
  const dados = sensores.filter((item) => item.ativo !== false && item.valor !== null && item.valor !== undefined && item.valor !== "" && Number.isFinite(Number(item.valor)));
  if (graficoLeituras) graficoLeituras.destroy();
  graficoLeituras = new Chart(canvas, {
    type: "bar",
    data: {
      labels: dados.map((item) => item.sensor || item.id_externo),
      datasets: [{
        label: "Ultima leitura",
        data: dados.map((item) => Number(item.valor)),
        backgroundColor: "#1976d2",
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

async function carregarDadosConectados() {
  const resultados = await Promise.allSettled([
    FrutLog.apiFetch("/funcionarios"),
    FrutLog.apiFetch("/sensores"),
    FrutLog.apiFetch("/painel-tecnico"),
    FrutLog.apiFetch("/talhoes"),
    FrutLog.apiFetch("/colheitas/anual"),
    FrutLog.apiFetch("/telemetria/diaria"),
  ]);
  const erros = [];

  if (resultados[0].status === "fulfilled") {
    funcionarios = resultados[0].value.usuarios || [];
    renderizarFuncionarios();
  } else {
    erros.push(`Funcionarios: ${resultados[0].reason.message}`);
    mostrarLinhasVazias("tabela-funcionarios", 7, "Falha ao carregar funcionarios.");
  }

  if (resultados[1].status === "fulfilled") {
    sensores = resultados[1].value.sensores || [];
    renderizarSensores();
    renderizarGraficoLeituras();
  } else {
    erros.push(`Sensores: ${resultados[1].reason.message}`);
    mostrarLinhasVazias("tabela-sensores-admin", 6, "Falha ao carregar sensores.");
  }

  if (resultados[2].status === "fulfilled") {
    painelTecnico = resultados[2].value;
    renderizarPainelTecnico();
    renderizarMapaAdmin();
  } else {
    erros.push(`Dados de campo: ${resultados[2].reason.message}`);
    exibirMensagem("mensagem-dados-tecnicos", resultados[2].reason.message, "erro");
  }

  if (resultados[3].status === "fulfilled") {
    if (window.FrutLogTalhoes) {
      FrutLogTalhoes.carregarDoServidor(resultados[3].value.talhoes || []);
      renderizarMapaAdmin();
      preencherSelectTalhoes();
    }
  } else {
    erros.push(`Geometrias: ${resultados[3].reason.message}`);
  }
  if (resultados[4].status === "fulfilled") {
    definirColheitasAnuais(resultados[4].value.colheitas);
  } else {
    erros.push(`Colheitas: ${resultados[4].reason.message}`);
  }
  if (resultados[5].status === "fulfilled") {
    telemetriaDiariaAdmin = resultados[5].value.leituras || [];
    renderizarTelemetriaDiariaAdmin();
  } else {
    erros.push(`Telemetria diaria: ${resultados[5].reason.message}`);
    mostrarLinhasVazias("tabela-telemetria-admin", 7, "Falha ao carregar telemetria diaria.");
  }

  renderizarGraficoColheita();
  if (erros.length) {
    exibirMensagem("mensagem-carregamento-admin", erros.join(" | "), "erro");
  } else {
    exibirMensagem("mensagem-carregamento-admin", "Dados atualizados do servidor.", "sucesso");
  }

  if (!window.sincronizacaoAdminIniciada) {
    window.sincronizacaoAdminIniciada = true;
    window.setInterval(atualizarDadosCampoConectados, 15000);
  }
}

async function atualizarDadosCampoConectados() {
  try {
    const [painel, geometria, dadosSensores, colheitas, telemetria] = await Promise.all([
      FrutLog.apiFetch("/painel-tecnico"),
      FrutLog.apiFetch("/talhoes"),
      FrutLog.apiFetch("/sensores"),
      FrutLog.apiFetch("/colheitas/anual"),
      FrutLog.apiFetch("/telemetria/diaria"),
    ]);
    painelTecnico = painel;
    sensores = dadosSensores.sensores || [];
    definirColheitasAnuais(colheitas.colheitas);
    renderizarPainelTecnico();
    renderizarSensores();
    renderizarGraficoLeituras();
    renderizarGraficoColheita();
    telemetriaDiariaAdmin = telemetria.leituras || [];
    renderizarTelemetriaDiariaAdmin();
    FrutLogTalhoes.carregarDoServidor(geometria.talhoes || []);
    renderizarMapaAdmin();
  } catch (erro) {
    console.error("Falha ao sincronizar dados operacionais:", erro);
    exibirMensagem("mensagem-carregamento-admin", `Falha ao atualizar dados: ${erro.message}`, "erro");
  }
}
