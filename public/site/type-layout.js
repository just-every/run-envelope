// Keep command tokens whole using markup; preserve the exact copied whitespace.
for (const code of document.querySelectorAll('pre > code')) {
  if (code.children.length) continue
  const parts = code.textContent.split(/(\s+)/)
  const content = document.createDocumentFragment()
  for (let i = 0; i < parts.length; i++) {
    let text = parts[i]
    if (/^\s*$/.test(text)) { content.append(document.createTextNode(text)); continue }
    if ((/^(?:\||&&)$/.test(text) || /^\d+(?:\.\d+)?$/.test(text) && /^(?:h|min|hours|servers|days|GiB|MiB)[,.]?$/.test(parts[i + 2] || '')) && parts[i + 2]) { text += parts[i + 1] + parts[i + 2]; i += 2 }
    const span = document.createElement('span')
    span.style.whiteSpace = 'nowrap'; span.textContent = text; content.append(span)
  }
  code.replaceChildren(content)
}
// Group the ending of an inline command without changing its text or its larger existing groups.
for (const code of document.querySelectorAll('code')) {
  if ([...code.querySelectorAll('.code-word')].some(word => /\s/.test(word.textContent))) continue
  const text = code.textContent, match = /\S+[^\S\n]+\S+(?=\s*$)/.exec(text)
  if (!match) continue
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT), nodes = []
  for (let node; (node = walker.nextNode());) nodes.push(node)
  const locate = offset => { for (const node of nodes) { if (offset <= node.length) return [node, offset]; offset -= node.length } }
  const start = locate(match.index), end = locate(match.index + match[0].length)
  const range = document.createRange(); range.setStart(...start); range.setEnd(...end)
  const span = document.createElement('span'); span.style.whiteSpace = 'nowrap'; span.append(range.extractContents()); range.insertNode(span)
}
// Keep paragraph endings together across inline markup, including the docs and run shells.
for (const block of document.querySelectorAll('p,th,td,h1,h2,h3,h4,li')) {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT)
  const nodes = []
  for (let node; (node = walker.nextNode());) if (!node.parentElement.closest('svg,script,style,code,pre')) nodes.push(node)
  const text = nodes.map(node => node.data).join('')
  const ending = /[ \u00a0](?=\S+\s*$)/.exec(text)
  if (!ending || ending[0] !== ' ') continue
  let offset = ending.index
  for (const node of nodes) {
    if (offset < node.length) { node.data = node.data.slice(0, offset) + '\u00a0' + node.data.slice(offset + 1); break }
    offset -= node.length
  }
}
// Decorative dividers disappear at a wrap, retaining the same line metrics.
const separators = [...document.querySelectorAll('.flow-separator')]
function edge(node, forward) {
  if (node.nodeType === Node.TEXT_NODE && node.data.trim()) {
    const m = forward ? /\S/.exec(node.data) : /\S\s*$/.exec(node.data)
    const range = document.createRange()
    range.setStart(node, m.index); range.setEnd(node, m.index + 1)
    return range.getBoundingClientRect()
  }
  if (node.nodeType === Node.ELEMENT_NODE && !node.matches('svg, script')) {
    const children = [...node.childNodes]; if (!forward) children.reverse()
    for (const child of children) { const result = edge(child, forward); if (result) return result }
  }
}
function neighbor(el, forward) {
  let node = el
  while (node && node !== el.parentElement.closest('p,h1,h2,h3,li,th,td')) {
    let sibling = forward ? node.nextSibling : node.previousSibling
    while (sibling) { const result = edge(sibling, forward); if (result) return result; sibling = forward ? sibling.nextSibling : sibling.previousSibling }
    node = node.parentElement
  }
}
function layout() {
  for (const el of separators) {
    const before = neighbor(el, false), after = neighbor(el, true)
    el.classList.toggle('at-wrap', Boolean(before && after && Math.abs(before.top - after.top) > 8))
  }
}
new ResizeObserver(layout).observe(document.body)
document.fonts.ready.then(layout)
