// Os quatro cenários da A8. O aluno recebe o cenário pelo último dígito do RA antes do hífen
export const cenarios = [
  {
    numero: 1,
    titulo: 'Correção urgente em produção',
    digitos: [0, 4, 8],
    situacao: 'A função filtrarTarefas já está em uso na versão 1.4.0. O suporte abriu o chamado 4127 porque a busca por "revisar" não encontra "Revisar código". A correção precisa sair hoje. A equipe só aceita as mudanças necessárias para resolver esse erro.',
    regras: [
      'Pelo menos um dos testes do tester precisa encontrar o erro na versão atual do código.',
      'O coder deve partir do código atual e alterar no máximo quatro linhas.',
      'O código corrigido precisa passar nos testes do tester e nos testes de referência da página.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'relatoDoDefeito', titulo: 'Relato do chamado 4127' },
      { variavel: 'material_2', nome: 'codigoAtual', titulo: 'Código atual, versão 1.4.0' }
    ],
    gates: ['regressao', 'mudanca-minima'],
    explicacaoGates: [
      'A checagem regressao roda os cinco testes no código atual, que ainda tem o erro. Pelo menos um precisa falhar para mostrar que os testes detectam o problema.',
      'A checagem mudanca-minima soma as linhas removidas e adicionadas ao código atual. O limite é quatro. Linhas vazias e comentários não contam.'
    ],
    parametros: { maxLinhasAlteradas: 4 }
  },
  {
    numero: 2,
    titulo: 'Rastreabilidade entre critérios e testes',
    digitos: [1, 5, 9],
    situacao: 'O cliente quer conferir se cada comportamento descrito pelo spec tem um teste e um resultado. Para isso, cada critério precisa de um identificador, como C1 ou C2. Leia a política do cliente no material abaixo.',
    regras: [
      'Cada critério do spec começa com um identificador, como C1 ou C2. Esses IDs não podem se repetir.',
      'O spec tem no máximo cinco critérios.',
      'No campo criterio de cada teste, coloque primeiro o ID do critério que ele confere.',
      'Todo critério precisa ter pelo menos um teste.',
      'O código precisa passar nos testes do tester e nos testes de referência da página.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'politicaDeRastreabilidade', titulo: 'Política de rastreabilidade' }
    ],
    gates: ['rastreabilidade'],
    explicacaoGates: [
      'A checagem rastreabilidade confere os IDs dos critérios e dos testes. Ela reprova se faltar um ID, houver ID repetido ou inválido, existir critério sem teste ou o spec escrever mais de cinco critérios.'
    ],
    parametros: {}
  },
  {
    numero: 3,
    titulo: 'Padrão de código da equipe',
    digitos: [2, 6],
    situacao: 'A equipe usa uma revisão automática para conferir o padrão do código. Se alguma regra for desrespeitada, o código volta para correção. Cada nova tentativa exige outra consulta à IA.',
    regras: [
      'O código do coder precisa seguir as sete regras do material da equipe.',
      'A primeira resposta do coder já precisa passar na revisão.',
      'O código precisa passar nos testes do tester e nos testes de referência da página.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'padraoDeCodigo', titulo: 'Padrão de código da equipe' }
    ],
    gates: ['padrao-codigo'],
    explicacaoGates: [
      'A checagem padrao-codigo procura usos de class, let, var, any, for, while, push, splice, sort e reverse. Também confere ponto e vírgula no fim da linha e o limite de 20 linhas. As regras completas estão no material da equipe.'
    ],
    parametros: { maxLinhas: 20 }
  },
  {
    numero: 4,
    titulo: 'Qualidade dos testes medida por mutantes',
    digitos: [3, 7],
    situacao: 'Em uma execução anterior, os cinco testes do tester passaram, mas os testes de referência encontraram um erro. Faltava testar a diferença entre maiúsculas e minúsculas. Agora a equipe confere os testes usando sete versões de filtrarTarefas com erros conhecidos. Cada versão com erro é chamada de mutante.',
    regras: [
      'Os cinco testes do tester precisam detectar o erro em pelo menos seis dos sete mutantes. Detectar esse erro é o que chamamos de matar um mutante.',
      'O tester deve escrever os testes sem receber o código do coder nem o código dos mutantes.',
      'O código precisa passar nos testes do tester e nos testes de referência da página.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'tecnicasDeTeste', titulo: 'Técnicas de projeto de casos de teste' }
    ],
    gates: ['mutantes'],
    explicacaoGates: [
      'A checagem mutantes roda os cinco testes em cada versão com erro. Se algum teste falhar, ele detectou o problema e o mutante morreu. Pelo menos seis precisam morrer. O resultado lista os sobreviventes, que os testes não conseguiram detectar.'
    ],
    parametros: { minMutantesMortos: 6 }
  }
]

export const cenarioDoRa = ra => {
  const antesDoHifen = String(ra).split('-')[0].replace(/\D/g, '')
  if (antesDoHifen === '') return undefined
  const digito = Number(antesDoHifen.at(-1))
  return cenarios.find(cenario => cenario.digitos.includes(digito))
}
