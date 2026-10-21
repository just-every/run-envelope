import { DONE_CHECK, WARNING } from './glyphs'

const glyph = (svg: string) => function Glyph() { return <span className="glyph" dangerouslySetInnerHTML={{ __html: svg }} /> }

/** The one heavy done check. */
export const Done = glyph(DONE_CHECK)
/** The exception's warning, red. */
export const Warn = glyph(WARNING)
