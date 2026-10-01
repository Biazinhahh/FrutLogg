/* Dados temporários de desenvolvimento. Substituir por GET /talhoes quando a API existir.
   localStorage é somente ponte temporária entre telas/abas do mesmo navegador, não banco definitivo. */
const FrutLogTalhoes = (() => {
  const CHAVE_TEMPORARIA = "frutlog_talhoes_temporarios";
  const base = [
    { id: "A1", codigo: "A1", status: "Normal", produto: "Uva", variedade: "Uva Isabel", area: "10 hectares", solo: "Arenoso", plantio: "15/03/2026", colheita: "20/10/2026", sensor: "TEMP-A1-01", leitura: "31 C", prioridade: "Rotina de acompanhamento", geometria: [[180,135],[278,14],[298,18],[340,55],[285,120],[260,140],[202,141]] },
    { id: "A2", codigo: "A2", status: "Atencao", produto: "Manga", variedade: "Tommy Atkins", area: "8 hectares", solo: "Franco Arenoso", plantio: "10/02/2026", colheita: "18/09/2026", sensor: "SOLO-A2-01", leitura: "35%", prioridade: "Verificar umidade do solo", geometria: [[116,120],[136,127],[172,127],[195,142],[240,147],[235,215],[185,215],[145,205],[115,190]] },
    { id: "B1", codigo: "B1", status: "Normal", produto: "Uva", variedade: "Sugar Crisp", area: "9 hectares", solo: "Arenoso", plantio: "05/02/2026", colheita: "25/09/2026", sensor: "CHUVA-B1-01", leitura: "3,1 mm", prioridade: "Rotina de acompanhamento", geometria: [[285,120],[305,85],[340,95],[380,140],[350,170],[320,205],[285,235],[250,220],[235,185],[250,150],[270,135]] },
    { id: "B2", codigo: "B2", status: "Critico", produto: "Melao", variedade: "Goldex", area: "7,6 hectares", solo: "Franco Arenoso", plantio: "20/01/2026", colheita: "15/09/2026", sensor: "SOLO-B2-01", leitura: "28%", prioridade: "Checar sensor e irrigacao", geometria: [[75,85],[115,120],[187,107],[230,105],[220,85],[280,5],[230,5]] },
  ];
  function carregarTemporarios() {
    try {
      const salvo = localStorage.getItem(CHAVE_TEMPORARIA);
      return salvo ? JSON.parse(salvo) : structuredClone(base);
    } catch (erro) {
      console.warn("Não foi possível ler os talhões temporários.", erro);
      return structuredClone(base);
    }
  }
  let talhoes = carregarTemporarios();
  const persistirTemporarios = () => localStorage.setItem(CHAVE_TEMPORARIA, JSON.stringify(talhoes));
  const statusClasse = (status) => `status-${status.toLowerCase().replace("ç", "c").replace("ã", "a")}`;
  const listar = () => talhoes;
  const obter = (id) => talhoes.find((talhao) => talhao.id === id);
  const proximoCodigo = () => `N${talhoes.length + 1}`;
  const criar = (geometria) => {
    const codigo = proximoCodigo();
    const novo = { id: codigo, codigo, status: "Normal", produto: "Nao configurado", variedade: "--", area: "--", solo: "--", plantio: "--", colheita: "--", sensor: null, leitura: "--", prioridade: "Aguardando configuracao", geometria };
    talhoes.push(novo);
    persistirTemporarios();
    return novo;
  };
  const remover = (id) => { talhoes = talhoes.filter((talhao) => talhao.id !== id); persistirTemporarios(); };
  const atualizarGeometria = (id, geometria) => { const talhao = obter(id); if (talhao) { talhao.geometria = geometria; persistirTemporarios(); } };
  const substituir = (novosTalhoes) => { talhoes = structuredClone(novosTalhoes); persistirTemporarios(); };
  // A divisão exige operação geométrica (corte de polígono) que o SVG nativo não oferece.
  // Será implementada quando houver biblioteca compatível ou serviço de geoprocessamento.
  const dividir = () => null;
  return { listar, obter, criar, remover, atualizarGeometria, substituir, dividir, statusClasse };
})();
