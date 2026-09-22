# Emissor Doc — novos campos automáticos

## O que será feito
- Adicionar Data da primeira habilitação, Data de emissão, Validade, Categoria, Número de registro e ID.
- Gerar valores aleatórios válidos automaticamente ao abrir e ao iniciar um novo documento.
- Manter a Data de emissão entre 2 e 3 anos após a primeira habilitação.
- Exibir Validade, Categoria e Número de registro em vermelho.
- Renderizar o ID com 10 números em Courier New, com tamanho e rotação ajustáveis.
- Permitir arrastar todos os novos dados diretamente no template.
- Ampliar a área de configuração para mostrar o template completo e facilitar o posicionamento.
- Salvar posições, tamanhos e rotação para os próximos documentos.

## Limites
- A ferramenta Imagens existente não será alterada.
- O template base atual e os dados já existentes do Emissor Doc serão preservados.

## Detalhes técnicos
- Os valores de cada documento ficam no estado local da página; as configurações visuais ficam em `site_settings`, usando a chave já exclusiva do Emissor Doc.
- A exportação em PNG reproduzirá as posições, cores, fonte e rotação vistas no editor.
