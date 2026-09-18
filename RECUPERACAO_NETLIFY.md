# Recuperação do site na Netlify

## Registro da conferência

- Data da conferência: 18/09/2026.
- Repositório: `https://github.com/juliano0irineu-svg/relatorio-sla.git`.
- Branch preservada: `main`.
- Commit remoto confirmado no GitHub: `96622238693d32cd5f1941e53daf454818a3f9ed` (`Atualiza documentacao e nome do site [skip ci]`).
- A cópia local estava limpa e apontava para esse mesmo commit.
- Site existente: `https://relatorio-glpi.netlify.app`.
- Equipe Netlify: Grupo Barigui.
- Projeto Netlify: `relatorio-glpi`.
- Identificador do projeto (Site ID): `08bddd8e-d88b-4e62-a7f6-6e32285acd79`.

Este documento registra somente configurações de reconstrução. Não autoriza publicação, exclusão do site atual, alteração de conta, conexão com o Google Drive ou inclusão de segredos no Git.

## Configuração para recriar o site

Ao criar ou reconectar um site na Netlify, usar:

| Campo | Valor |
| --- | --- |
| Repositório | `juliano0irineu-svg/relatorio-sla` |
| Branch de produção | `main` |
| Diretório-base | raiz do repositório |
| Comando de build | `pnpm build` |
| Diretório de publicação | `dist/public` |
| Versão do Node | `20` |
| Gerenciador de pacotes | pnpm (versão declarada no `package.json`) |
| Redirecionamento SPA | `/*` para `/index.html`, status `200` |

Esses parâmetros já estão versionados em `netlify.toml`. O build executa o Vite para a interface e gera a saída estática em `dist/public`.

## Dados e variáveis de ambiente

- A versão publicada é de demonstração; os dados de exemplo estão no código versionado.
- A leitura de planilhas do Drive é somente local e depende de variáveis não versionadas.
- O `.env` e suas variações, além de planilhas (`.xlsx`, `.xls`, `.csv`) e diretórios de dados privados, estão bloqueados por `.gitignore`.
- O único modelo rastreado é `.env.example`, com `ENABLE_DRIVE_SYNC=false` e campos vazios para as três pastas do Drive. Ele não contém credenciais.
- Não cadastrar na Netlify variáveis do Drive nesta fase. Quando essa integração for aprovada, elas deverão ser criadas apenas na interface segura da Netlify, nunca no repositório ou em `netlify.toml`.

## Itens preservados no GitHub

- Código da interface React/Vite, servidor local e regras de cálculo compartilhadas.
- Dados de demonstração, filtros, busca, exportação e testes.
- Configuração de build e redirecionamento da Netlify.
- Documentação funcional e plano do projeto.
- Lockfile do pnpm e patch de dependência necessário ao projeto.

## Limites desta recuperação

- Não há planilhas operacionais, credenciais, arquivo `.env` ou dados reais no GitHub — isso é intencional.
- A configuração local que acessa o Drive não pode ser reconstruída apenas a partir do repositório; ela exigirá, no momento apropriado, as permissões e identificadores de pastas aprovados.
- Não há domínio customizado: somente `relatorio-glpi.netlify.app` está configurado.
- Não há variáveis de ambiente cadastradas atualmente na Netlify.
- A visibilidade de produção é pública; os Deploy Previews são privados. Essa visibilidade deve ser reconsiderada antes de qualquer integração com dados reais.
- Novas publicações permanecem pausadas pelos créditos, conforme informado. Nenhum deploy foi publicado nesta conferência.

## Conferência da Netlify em 18/09/2026

- O repositório conectado é `juliano0irineu-svg/relatorio-sla`, com deploy de produção a partir da branch `main`.
- O último deploy efetivamente publicado é o commit `0007403` em 17/09/2026, com a mensagem `Alinha lockfile ao pnpm do Netlify`.
- O commit de documentação `8bb8e2f` disparou um deploy automático em 18/09/2026, mas ele foi **ignorado** por exceder o crédito da conta. Não houve alteração no conteúdo em produção.
- A Netlify informa que os sites já publicados permanecem no ar, enquanto deploys de produção e Agent Runners estão pausados.

## Próximo passo seguro

Antes de qualquer reconstrução ou deploy, abrir o painel da Netlify da equipe Grupo Barigui em modo somente leitura e registrar: identificador do site, repositório/branch conectados, domínio configurado, controles de acesso e variáveis de ambiente existentes (somente os nomes, nunca os valores). Em seguida, comparar o último deploy disponível com o commit `9662223`. Só após essa conferência e uma aprovação explícita deverá ser criado um preview ou feita qualquer publicação.
