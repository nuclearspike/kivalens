export const prettifyCamelCase = str => {
  let output = '';
  if (!(typeof str === 'string' && str.length > 0)) return '';
  const len = str.length;
  let char;

  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < len; i++) {
    char = str.charAt(i);

    if (i === 0) {
      output += char.toUpperCase();
    } else if (char !== char.toLowerCase() && char === char.toUpperCase()) {
      output += ` ${char}`;
    } else if (char === '-' || char === '_') {
      output += ' ';
    } else {
      output += char;
    }
  }

  return output;
};

export const humanize = str => {
  return str
    .split('_')
    .map(frag => {
      return frag.charAt(0).toUpperCase() + frag.slice(1);
    })
    .join(' ');
};

export const arrayWithElements = test => Array.isArray(test) && test.length > 0;
export const mapArray = (arr, func) =>
  arrayWithElements(arr) ? arr.map(func) : [];
export const humanizeArray = (arr, textIfEmpty) =>
  arrayWithElements(arr) ? arr.map(t => humanize(t)).join(', ') : textIfEmpty;
