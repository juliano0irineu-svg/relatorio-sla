# Especificação da primeira versão

Este documento registra os requisitos da primeira versão como referência. O estado atual e as próximas etapas estão em [PLANO_DO_PROJETO.md](PLANO_DO_PROJETO.md).

## Público

Gestores e responsáveis que precisam acompanhar volume de chamados e tempo de atendimento sem abrir planilhas.

## Estrutura da tela

### Menu lateral

- Resumo geral
- Indiretos
- Suprimentos Adm
- Transportes

O menu deve manter a identidade azul já aprovada no painel recuperado e permitir reduzir sua largura.

### Cabeçalho

- Nome da visão atual.
- Texto curto explicando o recorte.
- Indicador da origem dos dados: demonstração no site hospedado ou Drive na execução local configurada.
- Botão para atualizar a visualização.

### Filtros

- Ano
- Semestre
- Período inicial e final
- Área
- Responsável
- Busca por número de chamado

Os filtros devem funcionar juntos e deixar claro quantos chamados estão no recorte.

### Indicadores principais

- Chamados no período
- Tempo total útil
- Tempo médio útil
- Quantidade de responsáveis com chamados
- Quantidade de áreas no recorte
- Maior e menor duração

O painel deve destacar tempo médio, maior e menor tempo por comprador e por área.

### Detalhamento

- Distribuição de chamados por área.
- Distribuição por responsável.
- Lista de chamados do recorte, com número, tipo, abertura, fechamento e duração.
- Exportação apenas do que estiver filtrado.

## Dados de demonstração

Quando a leitura do Drive estiver desligada, a demonstração usa registros fictícios ou anonimizados contendo apenas:

| Campo | Uso no painel |
| --- | --- |
| Chamado | Busca e identificação |
| Área | Organização das visões |
| Responsável | Filtro e distribuição |
| Tipo | Comparação por assunto, quando disponível |
| Abertura | Início da contagem |
| Fechamento | Fim da contagem |

## Critérios de aceite

Os critérios definidos para a primeira prévia foram:

1. A tela estiver visualmente coerente com o painel recuperado.
2. Todos os filtros funcionarem em conjunto.
3. Os totais e as durações mudarem corretamente conforme o recorte.
4. A exportação trouxer somente os itens filtrados.
5. A demonstração funcionar sem dependência do Google Drive, de planilhas reais ou de credenciais.
6. O tempo útil contar somente de segunda a sexta-feira.

## Questões para revisões futuras

- Os três nomes de área estão corretos?
- Os indicadores principais acima são os mais importantes para abrir o painel?
- Você quer uma tabela de chamados visível já na primeira tela ou somente ao escolher uma área/responsável?
- Qual informação precisa aparecer primeiro para você ao abrir o resumo geral?
