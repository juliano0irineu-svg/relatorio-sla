# Especificação da primeira versão

Este documento é o rascunho da versão que será construída e revisada antes da conexão com o Google Drive.

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
- Indicador da origem dos dados: **Dados de demonstração** até a etapa final de integração.
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

Enquanto o Drive estiver desligado, a demonstração usará registros fictícios ou anonimizados contendo apenas:

| Campo | Uso no painel |
| --- | --- |
| Chamado | Busca e identificação |
| Área | Organização das visões |
| Responsável | Filtro e distribuição |
| Tipo | Comparação por assunto, quando disponível |
| Abertura | Início da contagem |
| Fechamento | Fim da contagem |

## Critérios de aceite

Consideraremos a primeira versão pronta para a prévia quando:

1. A tela estiver visualmente coerente com o painel recuperado.
2. Todos os filtros funcionarem em conjunto.
3. Os totais e as durações mudarem corretamente conforme o recorte.
4. A exportação trouxer somente os itens filtrados.
5. Não houver dependência do Google Drive, de planilhas reais ou de credenciais.
6. O tempo útil contar somente de segunda a sexta-feira.

## Decisões para sua revisão

- Os três nomes de área estão corretos?
- Os indicadores principais acima são os mais importantes para abrir o painel?
- Você quer uma tabela de chamados visível já na primeira tela ou somente ao escolher uma área/responsável?
- Qual informação precisa aparecer primeiro para você ao abrir o resumo geral?
