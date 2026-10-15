// Os quatro cenários da A8. O aluno recebe o cenário pelo último dígito do RA antes do hífen
export const cenarios = [
  {
    numero: 1,
    titulo: 'Correção urgente em produção',
    digitos: [0, 4, 8],
    situacao: 'A versão 1.4.0 de filtrarTarefas está em produção. O suporte abriu o chamado 4127: a busca por "revisar" não encontra "Revisar código". A correção sai hoje, e a equipe só aceita alterar o necessário para resolver o chamado.',
    regras: [
      'A suíte do tester reproduz o defeito relatado. Pelo menos um caso falha na versão atual.',
      'A correção parte do código atual e altera no máximo quatro linhas.',
      'Os casos do tester e a suíte de referência aprovam a correção.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'relatoDoDefeito', titulo: 'Relato do chamado 4127' },
      { variavel: 'material_2', nome: 'codigoAtual', titulo: 'Código atual, versão 1.4.0' }
    ],
    gates: ['regressao', 'mudanca-minima'],
    explicacaoGates: [
      'regressao executa os cinco casos do tester na versão atual e exige pelo menos uma falha.',
      'mudanca-minima compara a proposta com a versão atual. Conta linhas removidas mais linhas adicionadas, sem linhas vazias e comentários. O limite é 4.'
    ],
    parametros: { maxLinhasAlteradas: 4 }
  },
  {
    numero: 2,
    titulo: 'Rastreabilidade entre critérios e testes',
    digitos: [1, 5, 9],
    situacao: 'O cliente audita cada entrega e exige ligar cada critério de aceite a um caso de teste e a um resultado. A política do cliente está no material do cenário.',
    regras: [
      'Cada critério do spec começa com um ID C1, C2, sem repetição.',
      'O spec tem no máximo cinco critérios.',
      'O campo criterio de cada caso começa com o ID que o caso verifica.',
      'Todo critério tem pelo menos um caso.',
      'Os casos do tester e a suíte de referência aprovam a proposta.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'politicaDeRastreabilidade', titulo: 'Política de rastreabilidade' }
    ],
    gates: ['rastreabilidade'],
    explicacaoGates: [
      'rastreabilidade lê o ID no início de cada critério e de cada caso. Reprova critério sem ID, ID repetido, mais de cinco critérios, caso sem ID válido e critério sem caso.'
    ],
    parametros: {}
  },
  {
    numero: 3,
    titulo: 'Padrão de código da equipe',
    digitos: [2, 6],
    situacao: 'O repositório da equipe tem revisão automática de código. O módulo que viola o padrão da equipe volta para o autor, e cada volta custa mais uma chamada ao modelo.',
    regras: [
      'A proposta segue as sete regras do padrão de código.',
      'A primeira proposta do coder já passa na revisão.',
      'Os casos do tester e a suíte de referência aprovam a proposta.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'padraoDeCodigo', titulo: 'Padrão de código da equipe' }
    ],
    gates: ['padrao-codigo'],
    explicacaoGates: [
      'padrao-codigo verifica cada linha da proposta: class, ponto e vírgula no fim, let, var, any, for, while, push, splice, sort, reverse e o limite de 20 linhas de código.'
    ],
    parametros: { maxLinhas: 20 }
  },
  {
    numero: 4,
    titulo: 'Qualidade dos testes medida por mutantes',
    digitos: [3, 7],
    situacao: 'Em uma execução anterior, o tester aprovou 5 de 5 casos e a referência reprovou a proposta. Nenhum caso cobria maiúsculas e minúsculas. A equipe passou a medir a suíte do tester com sete mutantes, versões de filtrarTarefas com um defeito conhecido cada.',
    regras: [
      'Os cinco casos do tester matam pelo menos seis dos sete mutantes.',
      'O tester continua sem acesso ao código da proposta e aos mutantes.',
      'Os casos do tester e a suíte de referência aprovam a proposta.'
    ],
    materiais: [
      { variavel: 'material_1', nome: 'tecnicasDeTeste', titulo: 'Técnicas de projeto de casos de teste' }
    ],
    gates: ['mutantes'],
    explicacaoGates: [
      'mutantes executa os cinco casos do tester em cada mutante. O mutante morre quando algum caso falha. O gate exige seis mortos e lista os sobreviventes.'
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
