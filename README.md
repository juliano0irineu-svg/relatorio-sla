# Relatório GLPI

Painel para acompanhar quantos chamados cada comprador concluiu e quanto tempo levou entre a abertura e o fechamento, por área e período. O relatório mede o tempo observado; não compara o resultado com uma meta de SLA.

## Estado atual

- O painel recuperado está funcionando com resumo geral, áreas, filtros, busca e exportação.
- O [site no Netlify](https://relatorio-glpi.netlify.app/) foi publicado a partir do GitHub e está privado. A versão hospedada usa os dados de demonstração incluídos no projeto; ainda não recebe as planilhas do Drive.
- No computador de desenvolvimento, uma configuração local permite ler as planilhas do Drive. Essa configuração e as planilhas não estão no GitHub.
- O repositório é [juliano0irineu-svg/relatorio-sla](https://github.com/juliano0irineu-svg/relatorio-sla). O nome do repositório foi mantido para preservar os vínculos existentes.

## Como o tempo é calculado

O início é a data e hora de **ABERTURA** e o fim é a data e hora de **FECHAMENTO**. Sábados e domingos são descontados. Nesta versão, feriados e horas fora do expediente não são descontados. Chamados sem datas válidas ficam fora das médias de tempo.

## Organização

- `client/`: telas, filtros e dados de demonstração.
- `server/`: leitura das planilhas e serviços usados na execução local.
- `shared/`: regras e tipos compartilhados, incluindo o cálculo de tempo e os nomes consolidados dos compradores.
- `PLANO_DO_PROJETO.md`: estado do trabalho e próximas etapas.
- `ESPECIFICACAO_PRIMEIRA_VERSAO.md`: requisitos da primeira versão, mantidos como referência.
- `netlify.toml`: construção e publicação da versão hospedada.

## Próxima etapa

Definir como a versão hospedada receberá os dados reais com acesso controlado. Antes de torná-la pública, conferir os totais e os tempos calculados contra as planilhas do Drive e revisar quem poderá ver essas informações.

Nenhuma planilha operacional, senha, token ou arquivo `.env` deve entrar no repositório.
