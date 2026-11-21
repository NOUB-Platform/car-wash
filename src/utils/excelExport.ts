// Exports Arabic RTL-ready spreadsheets (.xls HTML format & .csv UTF-8 BOM)
// Opens cleanly in Microsoft Excel, Google Sheets, and LibreOffice without garbled Arabic text.

export interface ExcelColumn<T> {
  header: string;
  value: (row: T, index: number) => string | number;
}

function escapeHtml(raw: string | number): string {
  return String(raw ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function exportToExcelXls<T>(params: {
  filename: string;
  sheetTitle: string;
  columns: Array<ExcelColumn<T>>;
  rows: T[];
  footerNote?: string;
}): void {
  const { filename, sheetTitle, columns, rows, footerNote } = params;
  const safeName = filename.endsWith('.xls') ? filename : `${filename}.xls`;

  const headCells = columns
    .map(
      (col) =>
        `<th style="background:#1D4ED8;color:#FFFFFF;font-weight:bold;padding:8px 12px;border:1px solid #CBD5E1;text-align:right;white-space:nowrap;">${escapeHtml(
          col.header
        )}</th>`
    )
    .join('');

  const bodyRows = rows
    .map((row, idx) => {
      const bg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
      const cells = columns
        .map((col) => {
          const val = col.value(row, idx);
          const isNum = typeof val === 'number';
          return `<td style="background:${bg};padding:6px 10px;border:1px solid #CBD5E1;text-align:${
            isNum ? 'left' : 'right'
          };">${escapeHtml(val)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const footerRow = footerNote
    ? `<tr><td colspan="${columns.length}" style="background:#EEF2FF;padding:8px 12px;font-weight:bold;border:1px solid #CBD5E1;">${escapeHtml(
        footerNote
      )}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(
    sheetTitle.slice(0, 30)
  )}</x:Name><x:WorksheetOptions><x:DisplayRightToLeft/><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body style="font-family:Tahoma,Arial,sans-serif;direction:rtl;">
  <table>
    <thead>
      <tr>
        <th colspan="${columns.length}" style="background:#0F172A;color:#FFFFFF;font-size:15px;padding:10px 14px;text-align:right;">
          بيرفكت | Perfect — ${escapeHtml(sheetTitle)}
        </th>
      </tr>
      <tr>${headCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
      ${footerRow}
    </tbody>
  </table>
</body>
</html>`;

  const blob = new Blob(['\uFEFF', html], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
