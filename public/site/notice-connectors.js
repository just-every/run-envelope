// Draw the three margin annotations from the actual ring and note dots after type reflows.
const row = document.querySelector('.notice-row')
if (row) {
  const svg = row.querySelector('.note-links')
  const source = row.querySelector('.ringed')
  const notes = [...row.querySelectorAll('.notes li')]
  function connect() {
    const box = row.getBoundingClientRect()
    const start = source.getBoundingClientRect()
    const mobile = matchMedia('(max-width: 1179px)').matches
    const x = start.right - box.left + (mobile ? 0 : 30)
    const y = start.top - box.top + start.height / 2
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`)
    svg.innerHTML = notes.map(note => {
      const end = note.getBoundingClientRect()
      const nx = mobile ? end.right - box.left : end.left - box.left - .5
      const ny = end.top - box.top + end.height / 2 + 1.5
      const bend = mobile ? box.width + 10 : x + (nx - x) / 2
      return `<path d="M${x},${y} C${bend},${y} ${bend},${ny} ${nx},${ny}"/>`
    }).join('')
  }
  new ResizeObserver(connect).observe(row)
  document.fonts.ready.then(connect)
}
