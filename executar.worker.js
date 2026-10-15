// Roda o código gerado pelo coder fora da página. A página encerra o worker se passar do prazo
import { avaliarCaso } from './verificador.js'

self.onmessage = async ({ data }) => {
  const { js, casos } = data
  const url = URL.createObjectURL(new Blob([js], { type: 'text/javascript' }))
  try {
    const modulo = await import(url)
    if (typeof modulo.filtrarTarefas !== 'function') throw new Error('O módulo não exporta filtrarTarefas')
    self.postMessage({ resultados: casos.map(caso => avaliarCaso(modulo.filtrarTarefas, caso)) })
  } catch (erro) {
    self.postMessage({ erro: erro instanceof Error ? erro.message : String(erro) })
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Avisa a página que o worker carregou. O prazo de execução começa depois deste aviso
self.postMessage({ pronto: true })
