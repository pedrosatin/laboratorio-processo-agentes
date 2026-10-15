# A8. Processo de software nos agentes

Página da atividade A8 de Tecnologias Emergentes em Engenharia de Software (ESOFT8), 15/10/2026.

- `index.html`: roteiro, cenários e verificador. O verificador roda o código do coder em um Web Worker do navegador, executa os casos do tester e a suíte de referência e aplica os gates do cenário.
- `dify/a8-spec-coder-tester.yml`: workflow do Dify com os agentes spec, coder e tester. O tester recebe só a especificação.
- `dify/a8-spec-coder-tester-sequencial.yml`: mesma configuração, com tester e coder em sequência.

Para abrir localmente, sirva a pasta por HTTP (`python3 -m http.server`). Módulos ES e workers não carregam por `file://`.
