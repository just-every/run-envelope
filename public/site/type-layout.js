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
