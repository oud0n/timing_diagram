/** Inline computed SVG presentation styles so the exported image needs no app CSS. */
export function serializeWaveformSvg(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originals = [svg, ...svg.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  const properties = ['fill', 'fill-opacity', 'stroke', 'stroke-opacity', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'visibility'];
  originals.forEach((source, i) => {
    const styles = getComputedStyle(source);
    properties.forEach(property => (copies[i] as SVGElement).style.setProperty(property, styles.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^)"']+)["']?\)/g, 'url(#$1)')));
  });
  clone.querySelectorAll('[data-export-exclude]').forEach(element => element.remove());
  clone.querySelectorAll('[data-sticky-labels]').forEach(element => element.setAttribute('transform', 'translate(0, 0)'));
  [clone, ...clone.querySelectorAll('*')].forEach(element => {
    element.removeAttribute('class');
    for (const attr of [...element.attributes]) if (attr.name.startsWith('data-')) element.removeAttribute(attr.name);
  });
  clone.removeAttribute('xmlns');
  clone.setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('viewBox', `0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}
