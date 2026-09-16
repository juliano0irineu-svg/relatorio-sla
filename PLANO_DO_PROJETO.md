# Plano do Relatório SLA

## Propósito

Transformar o painel recuperado em um relatório de SLA confiável e simples de usar. Primeiro construiremos e validaremos a experiência com dados de demonstração. A conexão com as planilhas do Google Drive ficará para a etapa final.

## O que já temos

- Painel recuperado com menu, filtros por área, comprador, ano e semestre, busca, métricas e exportação.
- Identidade visual de referência (azul Grupo Barigüi e estrutura do painel antigo).
- Estrutura de três áreas: Indiretos, Suprimentos Adm e Transportes.
- Fontes reais preservadas no Drive, fora do repositório.

## Primeira versão que queremos validar

O painel deve permitir que uma pessoa responda, sem precisar abrir planilhas:

1. Quantos chamados foram recebidos e concluídos no período?
2. Qual área e qual responsável concentram mais chamados?
3. Quanto tempo os chamados levaram para ser concluídos em dias e horas úteis?
4. Quais chamados ficaram acima do prazo definido?
5. Como os resultados mudam por mês, semestre e ano?

## Funcionalidades da primeira versão

- Resumo geral com totais, média, maior e menor duração.
- Filtros por área, responsável, ano, semestre e período.
- Busca por número do chamado.
- Lista de chamados filtrados e exportação do recorte.
- Indicadores de SLA: dentro do prazo, fora do prazo e em risco.
- Explicação visível de como o tempo é calculado.

## Regras que ainda precisam de decisão

| Assunto | Decisão necessária |
| --- | --- |
| Prazo de SLA | Qual é o prazo para cada tipo ou prioridade de chamado? |
| Tempo útil | Dias úteis apenas ou também horário comercial e feriados? |
| Marco inicial | Abertura do chamado ou primeira resposta? |
| Marco final | Fechamento, solução ou encerramento? |
| Pausas | Chamados aguardando terceiros suspendem a contagem? |
| Prioridade | Quais campos definem urgência e prazo? |

## Sequência de trabalho

1. Registrar e aprovar as regras acima.
2. Ajustar o painel usando apenas dados fictícios ou anonimizados.
3. Testar filtros, cálculos e indicadores com cenários conhecidos.
4. Revisar visualmente a prévia com você.
5. Conectar o Google Drive apenas quando o painel e as regras estiverem aprovados.
6. Validar os totais contra as planilhas reais antes de publicar.

## Proteção dos dados

- Planilhas reais não entram no GitHub.
- Nenhuma credencial, token ou configuração privada entra no repositório.
- A conexão com Drive será somente de leitura.
- Publicação no Netlify só acontece após sua aprovação explícita.

## Próxima decisão prática

Definir a primeira regra de SLA: qual prazo devemos considerar para um chamado comum e quais casos devem ter prazo diferente.
