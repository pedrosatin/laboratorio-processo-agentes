// Leitura da saída do Dify, execução dos casos e gates de cada cenário.
// Não depende do navegador: a função que roda o código chega por parâmetro

// Aceita JSON puro, JSON dentro de cerca Markdown ou texto com um objeto no meio
export const extrairJson = texto => {
  if (typeof texto !== 'string') return texto
  const semCerca = texto.replace(/```(?:json)?/gi, '').trim()
  try {
    return JSON.parse(semCerca)
  } catch {
    const inicio = semCerca.indexOf('{')
    const fim = semCerca.lastIndexOf('}')
    if (inicio < 0 || fim <= inicio) throw new Error('Nenhum objeto JSON encontrado')
    return JSON.parse(semCerca.slice(inicio, fim + 1))
  }
}

const tipoTarefa = tarefa =>
  tarefa !== null && typeof tarefa === 'object' && Number.isInteger(tarefa.id) &&
  typeof tarefa.titulo === 'string' && typeof tarefa.concluida === 'boolean'

export const validarSpec = spec => {
  const erros = []
  if (!spec || typeof spec !== 'object') return ['spec não é um objeto']
  if (typeof spec.requisito !== 'string' || spec.requisito === '') erros.push('spec sem requisito')
  if (!Array.isArray(spec.criterios) || spec.criterios.length < 3) erros.push('spec precisa de pelo menos três critérios')
  else if (spec.criterios.some(criterio => typeof criterio !== 'string')) erros.push('todo critério precisa ser texto')
  if (!Array.isArray(spec.duvidas)) erros.push('spec sem a lista duvidas')
  return erros
}

export const validarProposta = proposta => {
  if (!proposta || typeof proposta !== 'object') return ['proposta do coder não é um objeto']
  return typeof proposta.codigo === 'string' && proposta.codigo.trim() !== '' ? [] : ['proposta sem o campo codigo']
}

export const validarCasos = casos => {
  if (!Array.isArray(casos)) return ['tester sem a lista casos']
  const erros = casos.length === 5 ? [] : [`o tester entregou ${casos.length} casos, e o processo pede exatamente cinco`]
  casos.forEach((caso, i) => {
    const rotulo = `caso ${i + 1}`
    if (typeof caso?.nome !== 'string') erros.push(`${rotulo} sem nome`)
    if (typeof caso?.criterio !== 'string') erros.push(`${rotulo} sem criterio`)
    if (!Array.isArray(caso?.tarefas) || !caso.tarefas.every(tipoTarefa)) erros.push(`${rotulo} com tarefas fora do tipo Tarefa`)
    if (typeof caso?.filtro?.estado !== 'string') erros.push(`${rotulo} sem filtro.estado`)
    if ((caso?.esperadoIds === undefined) === (caso?.esperadoErro === undefined)) erros.push(`${rotulo} precisa de esperadoIds ou esperadoErro, só um dos dois`)
  })
  return erros
}

// A saída do Dify chega como { spec, proposta, casos }, cada campo em texto ou objeto
export const lerEntrega = texto => {
  const bruto = extrairJson(texto)
  const campo = (nome, alternativas) => {
    const chave = [nome, ...alternativas].find(opcao => bruto[opcao] !== undefined && bruto[opcao] !== '')
    if (chave === undefined) return undefined
    return extrairJson(bruto[chave])
  }
  const spec = campo('spec', [])
  const proposta = campo('proposta', ['coder'])
  const tester = campo('casos', ['tester'])
  const casos = Array.isArray(tester) ? tester : tester?.casos
  return { spec, proposta, casos }
}

const igual = (a, b) => {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const chavesA = Object.keys(a)
  const chavesB = Object.keys(b)
  return chavesA.length === chavesB.length && chavesA.every(chave => igual(a[chave], b[chave]))
}

// Mesma regra do executor do CLI: ids na ordem, entrada intacta e objetos com os valores originais
export const avaliarCaso = (filtrar, caso) => {
  const base = { nome: caso.nome, criterio: caso.criterio }
  const entrada = structuredClone(caso.tarefas)
  try {
    const saida = filtrar(entrada, structuredClone(caso.filtro))
    if (!igual(entrada, caso.tarefas)) return { ...base, aprovado: false, detalhe: 'A lista de entrada foi alterada' }
    if (caso.esperadoErro !== undefined) return { ...base, aprovado: false, detalhe: `Esperava erro "${caso.esperadoErro}" e recebeu uma lista` }
    if (!Array.isArray(saida)) return { ...base, aprovado: false, detalhe: 'O retorno não é uma lista' }
    const ids = saida.map(tarefa => tarefa?.id)
    if (!igual(ids, caso.esperadoIds)) return { ...base, aprovado: false, detalhe: `Esperava ids ${JSON.stringify(caso.esperadoIds)} e recebeu ${JSON.stringify(ids)}` }
    const preservados = saida.every(tarefa => caso.tarefas.some(original => igual(tarefa, original)))
    return preservados ? { ...base, aprovado: true, detalhe: 'ok' } : { ...base, aprovado: false, detalhe: 'Objetos retornados diferem dos originais' }
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    if (caso.esperadoErro === undefined) return { ...base, aprovado: false, detalhe: `Erro inesperado: ${mensagem}` }
    return mensagem === caso.esperadoErro
      ? { ...base, aprovado: true, detalhe: 'ok' }
      : { ...base, aprovado: false, detalhe: `Esperava erro "${caso.esperadoErro}" e recebeu "${mensagem}"` }
  }
}

export const resumir = resultados => ({
  total: resultados.length,
  aprovados: resultados.filter(resultado => resultado.aprovado).length,
  resultados
})

const idDoCriterio = texto => /^\s*(C\d+)\b/.exec(texto ?? '')?.[1]

const rastreabilidade = async ({ spec, casos }) => {
  const detalhes = []
  const ids = spec.criterios.map(idDoCriterio)
  spec.criterios.forEach((criterio, i) => {
    if (!ids[i]) detalhes.push(`Critério sem ID no início: "${criterio.slice(0, 60)}"`)
  })
  const validos = new Set(ids.filter(Boolean))
  if (validos.size !== ids.filter(Boolean).length) detalhes.push('Há IDs de critério repetidos')
  if (spec.criterios.length > 5) detalhes.push(`O spec tem ${spec.criterios.length} critérios e o tester entrega cinco casos`)
  const cobertos = new Set()
  casos.forEach(caso => {
    const id = idDoCriterio(caso.criterio)
    if (!id || !validos.has(id)) detalhes.push(`Caso "${caso.nome}" não cita um ID de critério existente`)
    else cobertos.add(id)
  })
  validos.forEach(id => {
    if (!cobertos.has(id)) detalhes.push(`Critério ${id} sem caso de teste`)
  })
  return { gate: 'rastreabilidade', aprovado: detalhes.length === 0, detalhes }
}

const regressao = async ({ casos, dados, rodar }) => {
  const suite = await rodar(dados.versaoAtual, casos)
  const pegaram = suite.resultados.filter(resultado => !resultado.aprovado).map(resultado => resultado.nome)
  return pegaram.length > 0
    ? { gate: 'regressao', aprovado: true, detalhes: [`Casos que falham na versão atual: ${pegaram.join(', ')}`] }
    : { gate: 'regressao', aprovado: false, detalhes: ['Os cinco casos passam na versão atual, então nenhum reproduz o defeito relatado'] }
}

export const linhasDeCodigo = texto =>
  texto.split('\n').map(linha => linha.trim()).filter(linha => linha !== '' && !linha.startsWith('//'))

// Linhas removidas mais linhas adicionadas, pela maior subsequência comum
export const linhasAlteradas = (antes, depois) => {
  const tabela = antes.map(() => depois.map(() => 0))
  const valor = (i, j) => (i < 0 || j < 0 ? 0 : tabela[i][j])
  antes.forEach((linhaA, i) => depois.forEach((linhaB, j) => {
    tabela[i][j] = linhaA === linhaB ? valor(i - 1, j - 1) + 1 : Math.max(valor(i - 1, j), valor(i, j - 1))
  }))
  const comuns = valor(antes.length - 1, depois.length - 1)
  return antes.length - comuns + depois.length - comuns
}

const mudancaMinima = async ({ codigo, dados, parametros }) => {
  const limite = parametros.maxLinhasAlteradas
  const total = linhasAlteradas(linhasDeCodigo(dados.versaoAtual), linhasDeCodigo(codigo))
  return { gate: 'mudanca-minima', aprovado: total <= limite, detalhes: [`${total} linhas alteradas em relação à versão atual, limite ${limite}`] }
}

const regrasDoPadrao = [
  { regra: 'sem class', viola: linha => /\bclass\s+\w/.test(linha) },
  { regra: 'sem ponto e vírgula no fim da linha', viola: linha => /;\s*$/.test(linha) },
  { regra: 'sem let ou var', viola: linha => /\b(let|var)\s+\w/.test(linha) },
  { regra: 'sem any', viola: linha => /(:|as)\s*any\b/.test(linha) },
  { regra: 'sem laço for ou while', viola: linha => /\b(for|while)\s*\(/.test(linha) },
  { regra: 'sem push, splice, sort ou reverse', viola: linha => /\.(push|splice|sort|reverse)\(/.test(linha) }
]

const padraoCodigo = async ({ codigo, parametros }) => {
  const linhas = linhasDeCodigo(codigo)
  const detalhes = regrasDoPadrao.flatMap(({ regra, viola }) => {
    const ocorrencias = linhas.filter(viola)
    return ocorrencias.length > 0 ? [`Viola "${regra}" em ${ocorrencias.length} linha(s), por exemplo: ${ocorrencias[0]}`] : []
  })
  if (linhas.length > parametros.maxLinhas) detalhes.push(`Módulo com ${linhas.length} linhas de código, limite ${parametros.maxLinhas}`)
  return { gate: 'padrao-codigo', aprovado: detalhes.length === 0, detalhes }
}

const mutantes = async ({ casos, dados, parametros, rodar }) => {
  const resultados = await Promise.all(Object.entries(dados.mutantes).map(async ([nome, codigo]) => {
    const suite = await rodar(codigo, casos)
    return { nome, morto: suite.aprovados < suite.total }
  }))
  const mortos = resultados.filter(resultado => resultado.morto).length
  return {
    gate: 'mutantes',
    aprovado: mortos >= parametros.minMutantesMortos,
    detalhes: [
      `${mortos} de ${resultados.length} mutantes mortos, mínimo ${parametros.minMutantesMortos}`,
      ...resultados.filter(resultado => !resultado.morto).map(resultado => `Sobreviveu: ${resultado.nome}`)
    ]
  }
}

const gates = { rastreabilidade, regressao, 'mudanca-minima': mudancaMinima, 'padrao-codigo': padraoCodigo, mutantes }

// rodar(codigoTs, casos) devolve { total, aprovados, resultados }
export const verificar = async ({ entrega, cenario, dados, rodar }) => {
  const { spec, proposta, casos } = entrega
  const errosSpec = validarSpec(spec)
  if (errosSpec.length > 0) return { etapa: 'spec', erros: errosSpec }
  if (spec.duvidas.length > 0) return { etapa: 'duvidas', duvidas: spec.duvidas }
  const erros = [...validarProposta(proposta), ...validarCasos(casos)]
  if (erros.length > 0) return { etapa: 'formato', erros }
  const [tester, referencia] = await Promise.all([rodar(proposta.codigo, casos), rodar(proposta.codigo, dados.referencia)])
  const insumos = { spec, casos, codigo: proposta.codigo, dados, parametros: cenario.parametros, rodar }
  const resultadosGates = await Promise.all(cenario.gates.map(async nome => {
    try {
      return await gates[nome](insumos)
    } catch (erro) {
      return { gate: nome, aprovado: false, detalhes: [erro instanceof Error ? erro.message : String(erro)] }
    }
  }))
  const testerAprovou = tester.aprovados === tester.total
  return {
    etapa: 'verificado',
    tester,
    referencia,
    gates: resultadosGates,
    falsoNegativo: testerAprovou && referencia.aprovados < referencia.total,
    aprovado: testerAprovou && referencia.aprovados === referencia.total && resultadosGates.every(gate => gate.aprovado)
  }
}
