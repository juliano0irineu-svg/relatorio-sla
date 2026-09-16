/** @vitest-environment jsdom */
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { trpc } from "../client/src/lib/trpc";
import Home, { BuyerDetail, buildExportRows } from "../client/src/pages/Home";
import { normalizeRecord, summarizeBuyer, summarizeSemester } from "../shared/glpi";
import { areaReports, yearlyAreaReports } from "../client/src/data/glpiData";

describe("Resumo geral — fluxo interativo", () => {
  it("alterna área e semestre mantendo a visão geral e atualizando os KPIs", () => {
    const queryClient = new QueryClient();
    const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
    render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);

    expect(screen.getByText("Chamados em 2026")).toBeInTheDocument();
    expect(screen.getByText("Use os filtros acima para explorar a equipe")).toBeInTheDocument();
    expect(screen.getByTestId("search-export-bar")).toBeInTheDocument();
    expect(screen.getByTestId("area-filter")).toBeInTheDocument();
    expect(screen.getByTestId("buyer-filter")).toBeInTheDocument();
    expect(screen.getByText("Maior duração")).toBeInTheDocument();
    expect(screen.getByText("Menor duração")).toBeInTheDocument();
    expect(screen.queryByText(/^Áreas$/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Filtrar área"), { target: { value: "indiretos" } });
    expect(screen.getByText("Todos os compradores · Indiretos", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Resumo Indiretos")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("De"), { target: { value: "2026-01-01" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "2026-01-31" } });
    expect(screen.getAllByText(/0d 00h00/).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("De"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Até"), { target: { value: "" } });

    fireEvent.change(screen.getByLabelText("Semestre"), { target: { value: "second" } });
    expect(screen.getByText("Todos os compradores · Indiretos", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("0 chamados calculados")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^Suprimentos Adm$/ })[0]);
    fireEvent.change(screen.getByLabelText("Ano"), { target: { value: "2027" } });
    expect(screen.getAllByText("0 chamados calculados").length).toBeGreaterThan(0);
    expect(screen.getByText("Todos os compradores · Suprimentos Adm", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Resumo Suprimentos Adm")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Semestre"), { target: { value: "all" } });
    fireEvent.click(screen.getAllByRole("button", { name: /^Resumo geral$/ })[0]);
    fireEvent.change(screen.getByLabelText("Filtrar área"), { target: { value: "all" } });
    expect(screen.getByText("Chamados em 2027")).toBeInTheDocument();
  });
});

  it("atualiza o cartão lateral para o comprador selecionado", async () => {
    window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=first");
    const queryClient = new QueryClient();
    const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200, headers: { "content-type": "application/json" } }));
    render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const initialCalls = fetchMock.mock.calls.length;
    const refreshButton = screen.getAllByRole("button", { name: /Atualizar página/i })[0];
    expect(refreshButton).toBeEnabled();
    fireEvent.click(refreshButton);
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(initialCalls));
    fetchMock.mockRestore();

    const buyerFilter = screen.getByLabelText("Filtrar comprador");
    expect(buyerFilter).toHaveValue("");
    expect(screen.queryByText(/^Magno$/)).not.toBeInTheDocument();
    fireEvent.change(buyerFilter, { target: { value: "Alexandre Magno Brandao" } });

    expect(screen.getAllByText("Resumo do comprador").length).toBeGreaterThan(0);
    expect(screen.getByTestId("buyer-summary-inline")).toBeInTheDocument();
    expect(screen.queryByTestId("buyer-summary-card")).not.toBeInTheDocument();
    const ticketList = screen.getByTestId("buyer-ticket-list");
    expect(ticketList).toHaveClass("max-h-[332px]");
    expect(ticketList).toHaveClass("overflow-y-auto");
    expect(within(ticketList).getAllByRole("button")[0]).toHaveClass("h-[60px]");
    expect(within(ticketList).getAllByRole("button")).toHaveLength(7);
    expect(screen.getAllByText(/tempo médio útil/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/chamados calculados/).length).toBeGreaterThan(0);
    expect(screen.getByText("Escolha um chamado")).toBeInTheDocument();

    fireEvent.click(screen.getByText("2026 098 080"));
    expect(screen.getByText("Detalhe do chamado")).toBeInTheDocument();
    expect(screen.getByText("Abertura")).toBeInTheDocument();
    expect(screen.getByText("Fechamento")).toBeInTheDocument();
    expect(screen.getByText("Tempo útil · segunda a sexta")).toBeInTheDocument();
    expect(screen.getByText("0 dias e 21h32min")).toBeInTheDocument();
    expect(screen.getAllByText("2026 098 080").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("2026 096 237"));
    expect(screen.getAllByText("2026 096 237").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));
    expect(screen.getByText("Escolha um chamado")).toBeInTheDocument();
  });

it("exibe Data inválida para um chamado com datas inválidas", () => {
  const invalid = normalizeRecord({ chamado: "INV-1", abertura: "data inválida", fechamento: "2026-07-13T10:00:00" }, 0);
  render(<BuyerDetail buyer="Comprador teste" records={[invalid]} selectedRecordId={invalid.id} onSelectRecord={() => undefined} />);
  expect(screen.getByText("Data inválida", { selector: "p" })).toBeInTheDocument();
});

it("não duplica o comprador na lista quando o alias aparece em outro semestre", async () => {
  const originalFirst = yearlyAreaReports.indiretos[2026]!.first;
  const originalSecond = yearlyAreaReports.indiretos[2026]!.second;
  const firstRecord = normalizeRecord({ chamado: "DUP-1", abertura: "2026-07-13T09:00:00", fechamento: "2026-07-13T10:00:00" }, 0);
  const secondRecord = normalizeRecord({ chamado: "DUP-2", abertura: "2026-08-03T09:00:00", fechamento: "2026-08-03T11:00:00" }, 0);
  yearlyAreaReports.indiretos[2026]!.first = summarizeSemester("first", [summarizeBuyer("Alexandre Magno Brandao", [firstRecord])]);
  yearlyAreaReports.indiretos[2026]!.second = summarizeSemester("second", [summarizeBuyer("Magno", [secondRecord])]);
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=all");
  const view = render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  const currentView = within(view.container);

  await waitFor(() => expect(currentView.getByLabelText("Filtrar comprador")).toBeInTheDocument());
  const aliasBuyerFilter = currentView.getByLabelText("Filtrar comprador");
  fireEvent.change(aliasBuyerFilter, { target: { value: "Alexandre Magno Brandao" } });
  expect(currentView.queryByText(/^Magno$/)).not.toBeInTheDocument();
  expect(currentView.getByText(/2 chamados calculados/)).toBeInTheDocument();
  expect(currentView.getByTestId("buyer-summary-inline")).toBeInTheDocument();
  yearlyAreaReports.indiretos[2026]!.first = originalFirst;
  yearlyAreaReports.indiretos[2026]!.second = originalSecond;
});

it("busca chamados pelo número e combina a busca com a área no Resumo geral", async () => {
  window.history.replaceState({}, "", "?scope=geral&year=2026&semester=all");
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200, headers: { "content-type": "application/json" } }));
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const search = screen.getByRole("searchbox", { name: "Buscar chamados ou área" });
  fireEvent.change(search, { target: { value: "098 080" } });
  expect(screen.getByText("1 chamado encontrado")).toBeInTheDocument();
  expect(screen.queryByText("2026 096 237")).not.toBeInTheDocument();

  fireEvent.change(search, { target: { value: "indiretos" } });
  expect(screen.getByText("7 chamados encontrados")).toBeInTheDocument();
  fetchMock.mockRestore();
});

it("desabilita a exportação quando a busca não encontra chamados", () => {
  window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=first");
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar chamados ou área" }), { target: { value: "chamado inexistente" } });
  expect(screen.getByTestId("search-empty-state")).toHaveTextContent("Nenhum resultado encontrado");
  expect(screen.getByTestId("export-filtered")).toBeDisabled();
});

it("monta as linhas de exportação somente com os chamados filtrados", () => {
  const rows = buildExportRows(areaReports.indiretos.first, "Indiretos");
  expect(rows).toHaveLength(7);
  expect(rows[0]).toMatchObject({ Área: "Indiretos", Comprador: "Alexandre Magno Brandao", Chamado: "2026 098 080", "Tempo útil": "0 dias e 21h32min", Status: "Válido" });
  expect(rows[0]).toHaveProperty("Abertura");
  expect(rows[0]).toHaveProperty("Fechamento");
});

it("dispara o download Excel ao exportar os resultados", () => {
  window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=first");
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const createObjectURLMock = vi.fn(() => "blob:glpi");
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURLMock });
  const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  fireEvent.click(screen.getByTestId("export-filtered"));
  expect(createObjectURLMock).toHaveBeenCalledTimes(1);
  expect(clickMock).toHaveBeenCalledTimes(1);
  clickMock.mockRestore();
});

it("ordena os chamados por tempo útil e mostra a média compacta do comprador", async () => {
  window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=first");
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200, headers: { "content-type": "application/json" } }));
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText("Filtrar comprador"), { target: { value: "Alexandre Magno Brandao" } });

  expect(screen.getByTestId("selected-buyer-average")).toHaveTextContent("Média: 0d 18h01");
  const sortSelect = screen.getByLabelText("Ordenar");
  fireEvent.change(sortSelect, { target: { value: "desc" } });
  const ticketButtons = within(screen.getByTestId("buyer-ticket-list")).getAllByRole("button");
  expect(ticketButtons[0]).toHaveTextContent("2026 090 428");
  fireEvent.change(sortSelect, { target: { value: "asc" } });
  expect(within(screen.getByTestId("buyer-ticket-list")).getAllByRole("button")[0]).toHaveTextContent("2026 090 905");
  fetchMock.mockRestore();
});

it("avisa quando a sincronização do Drive é parcial", async () => {
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const partialSnapshot = {
    data: yearlyAreaReports,
    diagnostics: {
      checkedAt: "2026-08-28T00:00:00.000Z",
      hasIssues: true,
      areas: {
        indiretos: { status: "partial", yearsDiscovered: 4, filesDiscovered: 8, filesLoaded: 8, errors: [{ scope: "year", area: "indiretos", year: 2028, message: "Arquivo do 2º semestre não foi encontrado." }] },
        suprimentosAdm: { status: "ok", yearsDiscovered: 5, filesDiscovered: 10, filesLoaded: 10, errors: [] },
        transportes: { status: "ok", yearsDiscovered: 5, filesDiscovered: 10, filesLoaded: 10, errors: [] },
      },
    },
  };
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: partialSnapshot } } }]), { status: 200, headers: { "content-type": "application/json" } }));
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  await waitFor(() => expect(screen.getByText("Sincronização parcial do Drive")).toBeInTheDocument());
  expect(screen.getByText(/Arquivo do 2º semestre não foi encontrado/)).toBeInTheDocument();
  expect(screen.getByText(/Drive parcial · 1 alerta/)).toBeInTheDocument();
  fetchMock.mockRestore();
});

it("exibe a última base válida em cache quando o Drive não entrega dados", async () => {
  localStorage.setItem("relatorio-glpi:last-drive-snapshot:v1", JSON.stringify(yearlyAreaReports));
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200, headers: { "content-type": "application/json" } }));
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  await waitFor(() => expect(screen.getByText("Última base válida em cache local")).toBeInTheDocument());
  expect(screen.getByText("7 chamados encontrados")).toBeInTheDocument();
  fetchMock.mockRestore();
});

it("mantém a estrutura global preparada para telas estreitas", () => {
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);

  expect(screen.getByRole("navigation", { name: "Áreas do relatório" })).toBeInTheDocument();
  expect(screen.getByRole("main")).toHaveClass("min-w-0");
  expect(screen.getByTestId("search-export-bar")).toHaveClass("min-w-0");
  expect(screen.getByTestId("buyer-summary-blue")).toHaveClass("min-w-0");
});

it("filtra todos os quadros pelo comprador selecionado e permite voltar para a equipe", async () => {
  window.history.replaceState({}, "", "?scope=indiretos&year=2026&semester=first");
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([{ result: { data: { json: null } } }]), { status: 200, headers: { "content-type": "application/json" } }));
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());

  const buyerFilter = screen.getByLabelText("Filtrar comprador");
  expect(buyerFilter).toHaveValue("");
  fireEvent.change(buyerFilter, { target: { value: "Alexandre Magno Brandao" } });
  expect(screen.getByText("7 chamados calculados")).toBeInTheDocument();
  expect(screen.getByText("Alexandre Magno Brandao", { selector: "p" })).toBeInTheDocument();
  expect(screen.getByTestId("selected-buyer-average")).toHaveTextContent("Média:");

  fireEvent.change(buyerFilter, { target: { value: "" } });
  expect(buyerFilter).toHaveValue("");
  fetchMock.mockRestore();
});

it("exibe suporte, origem dos dados e o nome correto do produto", () => {
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);

  expect(screen.getByRole("heading", { name: "Relatório GLPI" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Grupo Barigüi" })).toHaveAttribute("src", "/manus-storage/grupo-barigui-logo-branca-final_600da188.png");
  expect(screen.queryByText("Painel interno")).not.toBeInTheDocument();
  expect(screen.getByTestId("creator-signature")).toHaveTextContent("Juliano Bueno Polidoro");
  expect(screen.getByTestId("creator-signature")).toHaveTextContent("v1.0.0");
  expect(screen.queryByTestId("data-origin-note")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Ajuda e suporte" }));
  expect(screen.getByRole("dialog", { name: "Ajuda e suporte" })).toHaveTextContent("Como usar o painel");
  expect(screen.getByTestId("data-origin-note")).toHaveTextContent("sistema GLPI");
});

it("recolhe e expande o menu lateral e retorna ao topo ao trocar de área", () => {
  const queryClient = new QueryClient();
  const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "http://127.0.0.1:9/api/trpc", transformer: superjson })] });
  const scrollToMock = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  render(<trpc.Provider client={trpcClient} queryClient={queryClient}><QueryClientProvider client={queryClient}><Home /></QueryClientProvider></trpc.Provider>);

  expect(screen.getByRole("img", { name: "Grupo Barigüi" })).toHaveAttribute("src", expect.stringContaining("grupo-barigui-logo-branca"));
  const collapseButton = screen.getByRole("button", { name: "Minimizar menu" });
  expect(screen.getByRole("complementary")).toHaveClass("duration-300");
  fireEvent.click(collapseButton);
  expect(screen.getByRole("button", { name: "Expandir menu" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Indiretos" })[0]).toHaveAttribute("title", "Indiretos");
  expect(screen.getAllByRole("button", { name: "Indiretos" })[0]).toHaveClass("hover:bg-[#d7ee58]");

  fireEvent.click(screen.getByRole("button", { name: "Expandir menu" }));
  expect(screen.getByRole("heading", { name: "Relatório GLPI" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: "Indiretos" })[0]);
  expect(scrollToMock).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  scrollToMock.mockRestore();
});
