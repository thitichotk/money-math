const cell = (value: string | number) => {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** Numbers stay raw (no thousands separators) so a spreadsheet can add them up. The BOM makes
 *  Excel read the Thai headers as UTF-8. */
export const downloadCsv = (filename: string, rows: (string | number)[][]) => {
  const blob = new Blob([`\uFEFF${rows.map((row) => row.map(cell).join(',')).join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href: url, download: `${filename}.csv` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};
