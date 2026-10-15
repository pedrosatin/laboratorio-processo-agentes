import { dados } from './dados.js'
import { cenarioDoRa } from './cenarios.js'
import { lerEntrega, resumir, verificar } from './verificador.js'
import { tirarTipos } from './vendor/sucrase.mjs'

const $ = id => document.getElementById(id)
const escapar = texto => String(texto).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const guardado = (chave, padrao) => {
  try {
    return JSON.parse(localStorage.getItem(chave)) ?? padrao
  } catch {
    return padrao
  }
}
const guardar = (chave, valor) => localStorage.setItem(chave, JSON.stringify(valor))

const estado = { cenario: undefined }

// Cenário pelo RA
const desenharCenario = () => {
  const ra = $('ra').value.trim()
  localStorage.setItem('a8-ra', ra)
  estado.cenario = cenarioDoRa(ra)
  const alvo = $('cenario-detalhe')
  if (!estado.cenario) {
    alvo.innerHTML = '<p class="mudo">Digite o RA para ver o cenário.</p>'
    desenharReserva()
    return
  }
  const c = estado.cenario
  alvo.innerHTML = `
    <h3>Cenário ${c.numero}. ${escapar(c.titulo)}</h3>
    <p>${escapar(c.situacao)}</p>
    <h4>Regras do processo</h4>
    <ol>${c.regras.map(regra => `<li>${escapar(regra)}</li>`).join('')}</ol>
    <h4>Materiais do projeto</h4>
    <p>Na linha de base, nenhum agente recebe estes materiais.</p>
    ${c.materiais.map(m => `
      <div class="campo-copia"><span>${escapar(m.titulo)}<br><code>${m.variavel}</code></span>
      <pre id="mat-${m.nome}">${escapar(dados.materiais[m.nome])}</pre>
      <button data-copiar="mat-${m.nome}">Copiar</button></div>`).join('')}
    <h4>O que o verificador confere</h4>
    <ul>${c.explicacaoGates.map(texto => `<li>${escapar(texto)}</li>`).join('')}
      <li>Em todos os cenários: os casos do tester e a suíte de referência executados contra o código do coder.</li></ul>`
  desenharReserva()
  desenharRodadas()
}

// Execução do código do coder em worker. O prazo conta a partir do carregamento do worker
const rodarEmWorker = (js, casos) => new Promise(resolver => {
  const worker = new Worker(new URL('./executar.worker.js', import.meta.url), { type: 'module' })
  const falhar = detalhe => resolver(resumir(casos.map(caso => ({ nome: caso.nome, criterio: caso.criterio, aprovado: false, detalhe }))))
  const estado = { prazo: undefined }
  const encerrar = () => {
    clearTimeout(estado.prazo)
    worker.terminate()
  }
  worker.onmessage = ({ data }) => {
    if (data.pronto) {
      estado.prazo = setTimeout(() => {
        encerrar()
        falhar('Tempo esgotado, 5 segundos')
      }, 5000)
      worker.postMessage({ js, casos })
      return
    }
    encerrar()
    if (data.erro) falhar(`Falha ao carregar o código: ${data.erro}`)
    else resolver(resumir(data.resultados))
  }
  worker.onerror = evento => {
    encerrar()
    falhar(`Falha ao carregar o código: ${evento.message ?? 'erro de sintaxe'}`)
  }
})

// Uma suíte por vez, para não disputar CPU e rede com vários workers
const fila = { ultima: Promise.resolve() }
const naFila = tarefa => {
  const proxima = fila.ultima.then(tarefa, tarefa)
  fila.ultima = proxima
  return proxima
}

const rodar = async (codigoTs, casos) => {
  try {
    const js = tirarTipos(codigoTs)
    return await naFila(() => rodarEmWorker(js, casos))
  } catch (erro) {
    return resumir(casos.map(caso => ({ nome: caso.nome, criterio: caso.criterio, aprovado: false, detalhe: `Erro de sintaxe: ${erro.message}` })))
  }
}

const resumoHash = async texto => {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].slice(0, 4).map(b => b.toString(16).padStart(2, '0')).join('')
}

const selo = (aprovado, textoOk = 'aprovado', textoErro = 'reprovado') =>
  `<span class="selo ${aprovado ? 'ok' : 'erro'}">${aprovado ? textoOk : textoErro}</span>`

const tabelaSuite = (titulo, suite) => `
  <h4>${titulo}: ${suite.aprovados}/${suite.total} ${selo(suite.aprovados === suite.total)}</h4>
  <table><thead><tr><th>Caso</th><th>Critério</th><th>Resultado</th></tr></thead><tbody>
  ${suite.resultados.map(r => `<tr><td>${escapar(r.nome)}</td><td>${escapar(r.criterio)}</td><td>${r.aprovado ? selo(true, 'ok') : `${selo(false, 'ok', 'falhou')} ${escapar(r.detalhe)}`}</td></tr>`).join('')}
  </tbody></table>`

const desenharResultado = (r, entrega) => {
  const alvo = $('resultado')
  if (r.etapa === 'spec' || r.etapa === 'formato') {
    alvo.innerHTML = `<div class="alerta erro"><strong>Saída fora do formato esperado.</strong><ul>${r.erros.map(e => `<li>${escapar(e)}</li>`).join('')}</ul>
      Confira se a instrução do agente ainda pede o formato JSON do final do prompt. A rodada foi registrada.</div>`
    return
  }
  if (r.etapa === 'duvidas') {
    alvo.innerHTML = `<div class="alerta"><strong>O spec parou com dúvidas.</strong><ol>${r.duvidas.map(d => `<li>${escapar(d)}</li>`).join('')}</ol>
      Responda no fim do campo Respostas e execute de novo no Dify.</div>`
    return
  }
  const gatesHtml = r.gates.map(g => `<li><strong>${g.gate}</strong> ${selo(g.aprovado)}<ul>${g.detalhes.map(d => `<li>${escapar(d)}</li>`).join('')}</ul></li>`).join('')
  alvo.innerHTML = `
    <div class="alerta ${r.aprovado ? 'ok' : 'erro'}"><strong>${r.aprovado ? 'Rodada aprovada: tester, referência e gates.' : 'Rodada reprovada em pelo menos um item.'}</strong>
    ${r.falsoNegativo ? '<br>Falso negativo: os casos do tester aprovaram e a suíte de referência reprovou. Algum comportamento do pedido ficou sem caso.' : ''}</div>
    <h4>Gates do cenário</h4><ul>${gatesHtml}</ul>
    ${tabelaSuite('Casos do tester', r.tester)}
    ${tabelaSuite('Suíte de referência', r.referencia)}
    <details><summary>Critérios do spec</summary><ol>${entrega.spec.criterios.map(c => `<li>${escapar(c)}</li>`).join('')}</ol></details>
    <details><summary>Código do coder</summary><pre>${escapar(entrega.proposta.codigo)}</pre></details>`
}

const verificarEntrega = async () => {
  if (!estado.cenario) {
    $('resultado').innerHTML = '<div class="alerta erro">Digite o RA na seção 1 antes de verificar.</div>'
    return
  }
  const texto = $('entrega').value.trim()
  if (texto === '') return
  const botao = $('verificar')
  botao.disabled = true
  try {
    const entrega = lerEntrega(texto)
    const r = await verificar({ entrega, cenario: estado.cenario, dados, rodar })
    desenharResultado(r, entrega)
    const rodada = {
      rotulo: $('rotulo').value, via: $('via').value, modelo: $('modelo').value.trim(),
      hora: new Date().toLocaleString('pt-BR'), hash: await resumoHash(texto), cenario: estado.cenario.numero, ra: $('ra').value.trim(),
      etapa: r.etapa, duvidas: r.duvidas ?? [], erros: r.erros ?? [],
      tester: r.tester ? `${r.tester.aprovados}/${r.tester.total}` : '-',
      referencia: r.referencia ? `${r.referencia.aprovados}/${r.referencia.total}` : '-',
      falhasReferencia: r.referencia ? r.referencia.resultados.filter(x => !x.aprovado).map(x => x.nome) : [],
      gates: r.gates ?? [], falsoNegativo: r.falsoNegativo ?? false, aprovado: r.aprovado ?? false
    }
    const rodadas = guardado('a8-rodadas', []).filter(x => !(x.rotulo === rodada.rotulo && x.cenario === rodada.cenario && x.ra === rodada.ra))
    guardar('a8-rodadas', [...rodadas, rodada])
    desenharRodadas()
  } catch (erro) {
    $('resultado').innerHTML = `<div class="alerta erro">Não consegui ler a entrega: ${escapar(erro.message)}. Copie o campo <code>entrega</code> inteiro, do primeiro <code>{</code> ao último <code>}</code>.</div>`
  } finally {
    botao.disabled = false
  }
}

const ordem = ['antes', 'depois', 'depois-2', 'depois-3']
const rodadasDoCenario = () => guardado('a8-rodadas', [])
  .filter(r => r.cenario === estado.cenario?.numero && r.ra === $('ra').value.trim())
  .sort((a, b) => ordem.indexOf(a.rotulo) - ordem.indexOf(b.rotulo))

const situacao = r => r.etapa === 'duvidas' ? 'parou com dúvidas' : r.etapa === 'verificado' ? '' : 'fora do formato'

const desenharRodadas = () => {
  const rodadas = rodadasDoCenario()
  $('tabela-rodadas').innerHTML = rodadas.length === 0
    ? '<p class="mudo">Nenhuma rodada verificada neste cenário.</p>'
    : `<table><thead><tr><th>Rótulo</th><th>Via e modelo</th><th>Hora</th><th>Tester</th><th>Referência</th><th>Gates</th><th>Entrega</th></tr></thead><tbody>
      ${rodadas.map(r => `<tr><td>${r.rotulo}</td><td>${escapar(r.via)}, ${escapar(r.modelo)}</td><td>${r.hora}</td><td>${r.tester}</td><td>${r.referencia}${r.falsoNegativo ? ' <span class="selo aviso">falso negativo</span>' : ''}</td>
        <td>${situacao(r) || r.gates.map(g => `${g.gate} ${selo(g.aprovado)}`).join('<br>')}</td><td><code>${r.hash}</code></td></tr>`).join('')}
      </tbody></table>`
}

const registro = () => {
  const c = estado.cenario
  const linhas = [`A8 | RA ${$('ra').value.trim()} | Cenário ${c.numero}. ${c.titulo}`]
  rodadasDoCenario().forEach(r => {
    linhas.push('', `Rodada ${r.rotulo} | ${r.via} ${r.modelo} | ${r.hora} | entrega ${r.hash}`)
    if (r.etapa === 'duvidas') linhas.push(`  parou com dúvidas: ${r.duvidas.join(' / ')}`)
    else if (r.etapa !== 'verificado') linhas.push(`  fora do formato: ${r.erros.join(' / ')}`)
    else {
      linhas.push(`  tester ${r.tester} | referência ${r.referencia} | falso negativo: ${r.falsoNegativo ? 'sim' : 'não'}`)
      if (r.falhasReferencia.length > 0) linhas.push(`  referência falhou em: ${r.falhasReferencia.join(', ')}`)
      r.gates.forEach(g => linhas.push(`  gate ${g.gate}: ${g.aprovado ? 'aprovado' : 'reprovado'}. ${g.detalhes.join(' | ')}`))
    }
  })
  return linhas.join('\n')
}

// Reserva: os mesmos prompts dos nós do workflow, montados na página
const prompts = {
  spec: materiais => `Pedido:\n${dados.pedido}\n\nTipo existente: ${dados.tipoExistente}\n\nAssinatura obrigatória: ${dados.assinatura}\n\nEstados aceitos: todas, abertas, concluidas\n\nRespostas da pessoa responsável pelo pedido:\n${dados.respostas}${materiais}`,
  coder: (materiais, spec) => `Tipo existente: ${dados.tipoExistente}\n\nAssinatura obrigatória: ${dados.assinatura}\n\nEspecificação:\n${spec}\n\nTentativa: 0\n\nFalhas da tentativa anterior: nenhuma${materiais}`,
  tester: (materiais, spec) => `Tipo existente: ${dados.tipoExistente}\n\nAssinatura obrigatória: ${dados.assinatura}\n\nEspecificação:\n${spec}${materiais}`
}

const reservaGuardada = () => guardado('a8-reserva', { instrucoes: { ...dados.instrucoes }, materiais: { spec: [], coder: [], tester: [] }, respostas: {} })

const desenharReserva = () => {
  const r = reservaGuardada()
  const nomes = estado.cenario?.materiais.map(m => m.nome) ?? []
  $('reserva-agentes').innerHTML = ['spec', 'tester', 'coder'].map(agente => `
    <div class="agente" data-agente="${agente}">
      <h3>${agente}</h3>
      <label style="display:flex">Instrução (System)<textarea rows="7" data-campo="instrucao">${escapar(r.instrucoes[agente])}</textarea></label>
      <div class="materiais">Materiais recebidos:
        ${nomes.length === 0 ? '<span class="mudo">digite o RA</span>' : nomes.map(nome => `<label><input type="checkbox" data-material="${nome}" ${r.materiais[agente].includes(nome) ? 'checked' : ''}>${nome}</label>`).join('')}
      </div>
      <div class="linha"><button data-prompt="${agente}">Copiar prompt completo</button>
        ${agente === 'spec' ? '' : '<span class="mudo">precisa da resposta do spec</span>'}</div>
      <label style="display:flex">Resposta do modelo<textarea rows="5" data-campo="resposta">${escapar(r.respostas[agente] ?? '')}</textarea></label>
    </div>`).join('')
}

const lerReserva = () => {
  const r = reservaGuardada()
  document.querySelectorAll('#reserva-agentes .agente').forEach(bloco => {
    const agente = bloco.dataset.agente
    r.instrucoes[agente] = bloco.querySelector('[data-campo=instrucao]').value
    r.respostas[agente] = bloco.querySelector('[data-campo=resposta]').value
    r.materiais[agente] = [...bloco.querySelectorAll('[data-material]')].filter(caixa => caixa.checked).map(caixa => caixa.dataset.material)
  })
  guardar('a8-reserva', r)
  return r
}

const promptCompleto = agente => {
  const r = lerReserva()
  const materiais = r.materiais[agente].map(nome => `\n\n${nome}:\n${dados.materiais[nome]}`).join('')
  const spec = r.respostas.spec ?? ''
  if (agente !== 'spec' && spec.trim() === '') throw new Error('Cole antes a resposta do spec')
  return `${r.instrucoes[agente]}\n\n---\n\n${prompts[agente](materiais, spec)}`
}

const copiar = async (texto, botao) => {
  await navigator.clipboard.writeText(texto)
  const original = botao.textContent
  botao.textContent = 'Copiado'
  setTimeout(() => { botao.textContent = original }, 1200)
}

document.addEventListener('click', async evento => {
  const botao = evento.target.closest('button')
  if (!botao) return
  if (botao.dataset.copiar) await copiar($(botao.dataset.copiar).textContent, botao)
  if (botao.dataset.prompt) {
    try {
      await copiar(promptCompleto(botao.dataset.prompt), botao)
    } catch (erro) {
      botao.textContent = erro.message
    }
  }
})
document.addEventListener('input', evento => {
  if (evento.target.closest('#reserva-agentes')) lerReserva()
})

$('ra').addEventListener('input', desenharCenario)
$('verificar').addEventListener('click', verificarEntrega)
$('copiar-registro').addEventListener('click', evento => estado.cenario && copiar(registro(), evento.target))
$('limpar-rodadas').addEventListener('click', () => {
  if (confirm('Apagar as rodadas deste navegador?')) {
    guardar('a8-rodadas', [])
    desenharRodadas()
  }
})
$('montar-reserva').addEventListener('click', () => {
  const r = lerReserva()
  $('entrega').value = JSON.stringify({ spec: r.respostas.spec ?? '', proposta: r.respostas.coder ?? '', casos: r.respostas.tester ?? '' })
  $('via').value = 'reserva'
  $('modelo').value = 'gemini (AI Studio)'
  location.hash = '#verificador'
})

$('copia-pedido').textContent = dados.pedido
$('copia-respostas').textContent = dados.respostas
$('ra').value = localStorage.getItem('a8-ra') ?? ''
desenharCenario()
