import {loadFont} from '@remotion/fonts';
import {staticFile} from 'remotion';

// Inter is bundled so text has the same width on every machine. Without it, a PC with no
// Inter installed falls back to a wider font and long words run off the frame.
export const FAMILY = 'Inter Shorts';
const faces: [string, string, 'normal' | 'italic'][] = [
  ['Regular', '400', 'normal'], ['Medium', '500', 'normal'], ['SemiBold', '600', 'normal'], ['Bold', '700', 'normal'],
  ['ExtraBold', '800', 'normal'], ['Black', '900', 'normal'], ['BlackItalic', '900', 'italic'],
];
for (const [file, weight, style] of faces) {
  loadFont({family: FAMILY, url: staticFile(`fonts/Inter-${file}.otf`), weight, style, format: 'opentype'});
}
