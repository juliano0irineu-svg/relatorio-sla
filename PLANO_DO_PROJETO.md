# Plano do Relatório GLPI

## Propósito

Comparar o volume e o tempo de atendimento dos chamados por comprador, área e período. O painel não usa uma meta de SLA para aprovar ou reprovar compradores.

## O que já foi feito

1. Recuperação do painel antigo e de sua identidade visual.
2. Resumo geral e visões de Indiretos, Suprimentos Adm e Transportes, com filtros, busca e exportação.
3. Cálculo do tempo entre abertura e fechamento, descontando sábados e domingos.
4. Consolidação dos nomes abreviados de compradores já confirmados, sem editar as planilhas de origem.
5. Leitura local, somente para consulta, das planilhas do Drive.
6. Publicação privada no [Netlify](https://relatorio-glpi.netlify.app/), ligada ao [GitHub](https://github.com/juliano0irineu-svg/relatorio-sla). O site hospedado ainda mostra dados de demonstração.

## Regra de cálculo atual

| Assunto | Regra |
| --- | --- |
| Início | Data e hora de ABERTURA do chamado. |
| Fim | Data e hora de FECHAMENTO do chamado. |
| Tempo útil | Conta de segunda a sexta-feira; sábados e domingos não contam. |
| Horário comercial | Não é aplicado nesta versão. |
| Feriados | Não são descontados nesta versão. |
| Datas ausentes ou inválidas | O chamado não entra nas médias de tempo. |

## Próximas etapas

1. Definir um modo de leitura dos dados do Drive para o site hospedado, com acesso adequado às planilhas.
2. Comparar os totais e os tempos do site com as planilhas reais por área, comprador e período.
3. Confirmar as diferenças entre nomes ou abas que ainda não foram explicadas.
4. Definir quem poderá acessar o painel com dados reais e, depois, decidir se ele deve continuar privado.
5. Revisar arquivos herdados que não forem necessários, sem retirar recursos usados pelo painel.

## Proteção dos dados

As planilhas, credenciais e a configuração local do Drive ficam fora do GitHub. O site publicado continua privado enquanto o acesso aos dados reais não estiver definido. A integração hospedada deve preservar a leitura das planilhas sem alterá-las.
