# Plano do Relatório de Tempo de Atendimento

## Propósito

Transformar o painel recuperado em um relatório confiável e simples para comparar o tempo de atendimento de cada comprador. Primeiro construiremos e validaremos a experiência com dados de demonstração. A conexão com as planilhas do Google Drive ficará para a etapa final.

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
4. Quais chamados exigiram mais tempo para serem concluídos?
5. Como os resultados mudam por mês, semestre e ano?

## Funcionalidades da primeira versão

- Resumo geral com totais, média, maior e menor duração.
- Filtros por área, responsável, ano, semestre e período.
- Busca por número do chamado.
- Lista de chamados filtrados e exportação do recorte.
- Comparação de tempo médio, maior e menor tempo entre compradores e áreas.
- Explicação visível de como o tempo útil é calculado.

## Regra de cálculo já definida

| Assunto | Regra |
| --- | --- |
| Início | Data e hora de abertura do chamado. |
| Fim | Data e hora de fechamento do chamado. |
| Tempo útil | Conta de segunda a sexta-feira; sábado e domingo não contam. |
| Horário comercial | Não é aplicado nesta versão. |
| Feriados | Não são descontados nesta versão. |

## Sequência de trabalho

1. Ajustar o painel usando apenas dados fictícios ou anonimizados.
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

Definir quais comparações devem aparecer em maior destaque: por comprador, por área, por tipo quando disponível, ou por período.
