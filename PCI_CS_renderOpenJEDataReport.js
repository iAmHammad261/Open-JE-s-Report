/**
 * @NScriptType ClientScript
 * @NApiVersion 2.1
 */

const main = (https) => {
  const OPEN_JE_DATA_SUITELET_SCRIPT_ID =
    "customscript_pci_sl_get_open_je_data";
  const OPEN_JE_DATA_SUITELET_DEPLOYMENT_ID =
    "customdeploy_pci_sl_get_open_je_data";
  const HTML_CONTAINER_ID = "custpage_open_je_report_html_val";
  let _cachedTableData = [];

  const renderLoader = (show) => {
    const LOADER_ID = "mdapproval-loader-overlay";

    if (!show) {
      const existing = document.getElementById(LOADER_ID);
      if (existing) existing.remove();
      return;
    }

    if (document.getElementById(LOADER_ID)) return;

    const loader = document.createElement("div");
    loader.id = LOADER_ID;
    loader.innerHTML = `
    <style>
      #mdapproval-loader-overlay {
        position: fixed;
        inset: 0;
        z-index: 9999;
        background: rgba(255, 255, 255, 0.75);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        padding-bottom: 40vh;
        gap: 16px;
        font-family: 'Open Sans', Helvetica, sans-serif;
      }

      .mdapproval-spinner {
        width: 48px;
        height: 48px;
        border: 5px solid #bfdbfe;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: mdapproval-spin 0.8s linear infinite;
      }

      .mdapproval-loader-text {
        font-size: 14px;
        font-weight: 600;
        color: #1e3a5f;
        letter-spacing: 0.5px;
      }

      @keyframes mdapproval-spin {
        to { transform: rotate(360deg); }
      }
    </style>

    <div class="mdapproval-spinner"></div>
    <span class="mdapproval-loader-text">Loading...</span>
  `;

    document.body.appendChild(loader);
  };

  const getOpenJEData = async () => {
    try {
      const response = await https.requestSuitelet.promise({
        scriptId: OPEN_JE_DATA_SUITELET_SCRIPT_ID,
        deploymentId: OPEN_JE_DATA_SUITELET_DEPLOYMENT_ID,
        method: https.Method.POST,
        body: {},
      });
      return { success: true, data: JSON.parse(response.body) };
    } catch (error) {
      console.error("Error fetching open JE data:", error);
      return { success: false };
    }
  };

  const prepareDataForAgGrid = async () => {
    const openJEDataResponse = await getOpenJEData();
    console.log("Open JE Data Response:", openJEDataResponse);
    if (!openJEDataResponse.success) return [];

    const openJEData = openJEDataResponse.data;
    const rows = [];

    for (const [entityId, entityData] of Object.entries(openJEData)) {
      const { entityName, missingJournals, invoices } = entityData;

      const journalLines = [];
      for (const [journalInternalId, lines] of Object.entries(
        missingJournals,
      )) {
        for (const lineData of Object.values(lines)) {
          journalLines.push({
            journalTranID: lineData.journalTranID,
            journalAccount: lineData.journalAccount,
            journalAmount: lineData.journalAmount,
            journalDate: lineData.journalDate,
            journalStatus: lineData.journalStatus,
            journalInternalId,
            journalProject: lineData.journalProject,
          });
        }
      }

      const invoiceLines = [];
      for (const [invoiceId, invoiceData] of Object.entries(invoices)) {
        invoiceLines.push({
          invoiceTranID: invoiceData.invoice_tranid,
          invoiceRemainingAmount: invoiceData.remaining_amount,
          invoiceTotalAmount: invoiceData.total_amount,
          invoicePaidAmount: invoiceData.paid_amount,
          invoiceId,
        });
      }

      const rowCount = Math.max(journalLines.length, invoiceLines.length, 1);

      for (let i = 0; i < rowCount; i++) {
        rows.push({
          entityName,
          entityId,
          isFirstRow: i === 0,
          isLastRow: i === rowCount - 1,
          rowSpan: rowCount,

          journalTranID: journalLines[i]?.journalTranID ?? null,
          journalDate: journalLines[i]?.journalDate ?? null,
          journalAccount: journalLines[i]?.journalAccount ?? null,
          journalAmount: journalLines[i]?.journalAmount ?? null,
          journalStatus: journalLines[i]?.journalStatus ?? null,
          journalProject: journalLines[i]?.journalProject ?? null,

          invoiceTranID: invoiceLines[i]?.invoiceTranID ?? null,
          invoiceRemainingAmount:
            invoiceLines[i]?.invoiceRemainingAmount ?? null,
          invoiceTotalAmount: invoiceLines[i]?.invoiceTotalAmount ?? null,
          invoicePaidAmount: invoiceLines[i]?.invoicePaidAmount ?? null,
          journalInternalId: journalLines[i]?.journalInternalId ?? null,
          invoiceId: invoiceLines[i]?.invoiceId ?? null,
        });
      }
    }

    return rows;
  };

  const calculatePinnedTotals = (tableData) => {
    const totals = {
      entityName: "TOTAL",
      journalAmount: 0,
      invoiceTotalAmount: 0,
      invoicePaidAmount: 0,
      invoiceRemainingAmount: 0,
    };

    tableData.forEach((row) => {
      if (row.journalAmount)
        totals.journalAmount += parseFloat(row.journalAmount) || 0;
      if (row.invoiceTotalAmount)
        totals.invoiceTotalAmount += parseFloat(row.invoiceTotalAmount) || 0;
      if (row.invoicePaidAmount)
        totals.invoicePaidAmount += parseFloat(row.invoicePaidAmount) || 0;
      if (row.invoiceRemainingAmount)
        totals.invoiceRemainingAmount +=
          parseFloat(row.invoiceRemainingAmount) || 0;
    });

    return totals;
  };

  const expandParentContainers = (startElement) => {
    let el = startElement?.parentElement;
    while (el && el !== document.body) {
      el.style.setProperty("width", "100%", "important");
      el.style.setProperty("maxWidth", "none", "important");
      el.style.setProperty("tableLayout", "fixed", "important");
      el = el.parentElement;
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "—";
    const val = parseFloat(value);
    if (isNaN(val)) return "—";
    return val.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const currencyCellStyle = (params) => {
    const base = { justifyContent: "flex-end", textAlign: "right" };
    if (params.value !== null && params.value !== undefined) {
      const val = parseFloat(params.value);
      if (!isNaN(val) && val < 0)
        return { ...base, color: "#721c24", fontWeight: "600" };
    }
    return base;
  };

  const getColumnDefs = () => [
    {
      headerName: "Customer",
      field: "entityName",
      pinned: "left",
      wrapText: true,
      rowSpan: (params) => (params.data?.isFirstRow ? params.data.rowSpan : 1),
      cellClassRules: {
        "je-entity-span": (params) => params.data?.isFirstRow,
      },
      cellRenderer: (params) => {
        if (params.node.rowPinned) {
          return `<span style="font-weight:700;font-size:13px;">${params.value || "—"}</span>`;
        }

        if (!params.data.isFirstRow) return "";

        const entityId = params.data.entityId;
        const url = `https://8232113.app.netsuite.com/app/common/entity/custjob.nl?id=${entityId}&whence=`;

        return `
      <a href="${url}" target="_blank" style="color:#1d4ed8;text-decoration:underline;font-weight:700;font-size:13px;">
        ${params.value || "—"}
      </a>
    `;
      },
    },
    {
      headerName: "Open Journals",
      headerClass: "je-col-group-header",
      children: [
        {
          headerName: "JE #",
          field: "journalTranID",
          width: 100,
          valueFormatter: (p) => p.value ?? "—",
          cellRenderer: (params) => {
            if (!params.value || !params.data.journalInternalId) return "—";
            const url = `https://8232113.app.netsuite.com/app/accounting/transactions/journal.nl?id=${params.data.journalInternalId}&whence=`;
            return `<a href="${url}" target="_blank" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">${params.value}</a>`;
          },
        },
        {
          headerName: "Date",
          field: "journalDate",
          width: 150,
          valueFormatter: (p) => p.value ?? "—",
        },
        {
          headerName: "Account",
          field: "journalAccount",
          width: 200,
          wrapText: true,
          cellStyle: {
            alignItems: "center", 
            textAlign: "left", 
            justifyContent: "flex-start", 
            whiteSpace: "normal",
            lineHeight: "1.5",
            paddingLeft: "12px",
          },
          valueFormatter: (p) => p.value ?? "—",
        },
         {
          headerName: "Project",
          field: "journalProject",
          width: 150,
          wrapText: true,
          cellStyle: {
            alignItems: "center", 
            textAlign: "left", 
            justifyContent: "flex-start", 
            whiteSpace: "normal",
            lineHeight: "1.5",
            paddingLeft: "12px",
          },
          valueFormatter: (p) => p.value ?? "—",
        },
        {
          headerName: "Status",
          field: "journalStatus",
          width: 150,
          wrapText: true,
          valueFormatter: (p) => p.value ?? "—",
        },
        {
          headerName: "JE Amount",
          field: "journalAmount",
          width: 140,
          cellStyle: currencyCellStyle,
          valueFormatter: (p) => formatCurrency(p.value),
        },
      ],
    },
    {
      headerName: "Invoices",
      headerClass: "je-col-group-header",
      children: [
        {
          headerName: "Invoice Number",
          field: "invoiceTranID",
          width: 160,
          valueFormatter: (p) => p.value ?? "—",
          cellRenderer: (params) => {
            if (!params.value || !params.data.invoiceId) return "—";
            const url = `https://8232113.app.netsuite.com/app/accounting/transactions/custinvc.nl?id=${params.data.invoiceId}&whence=`;
            return `<a href="${url}" target="_blank" style="color:#1d4ed8;text-decoration:underline;font-weight:600;">${params.value}</a>`;
          },
        },
        {
          headerName: "Total Amount",
          field: "invoiceTotalAmount",
          width: 200,
          cellStyle: currencyCellStyle,
          valueFormatter: (p) => formatCurrency(p.value),
        },
        {
          headerName: "Paid Amount",
          field: "invoicePaidAmount",
          width: 200,
          cellStyle: currencyCellStyle,
          valueFormatter: (p) => formatCurrency(p.value),
        },
        {
          headerName: "Remaining Amount",
          field: "invoiceRemainingAmount",
          width: 200,
          cellStyle: currencyCellStyle,
          valueFormatter: (p) => formatCurrency(p.value),
        },
      ],
    },
  ];

  const injectAgGridUI = (container) => {
    container.innerHTML = `
      <link rel="stylesheet"
        href="https://unpkg.com/ag-grid-community@31.3.2/styles/ag-grid.css">
      <link rel="stylesheet"
        href="https://unpkg.com/ag-grid-community@31.3.2/styles/ag-theme-alpine.css">

      <style>
        .open-je-wrapper {
          width: 100%;
          box-sizing: border-box;
          margin-top: 15px;
          font-family: 'Open Sans', Helvetica, sans-serif;
        }

        #open-je-report {
          width: 100%;
          height: 75vh;
        }

        /* ── Header: leaf columns ── */
        #open-je-report .ag-header-cell {
          background-color: #2563eb !important;
          font-weight: 700 !important;
          font-size: 13px !important;
          color: #ffffff !important;
          border-right: 1px solid #1a4fba !important;
        }
        #open-je-report .ag-header-cell-text {
          text-align: center;
          width: 100%;
        }

        /* ── Header: column groups ── */
        #open-je-report .ag-header-group-cell {
          background-color: #dbeafe !important;
          font-weight: 700 !important;
          font-size: 14px !important;
          color: #1e3a5f !important;
          border-right: 1px solid #93c5fd !important;
          justify-content: center !important;
        }

        /* ── Cells: center everything ── */
        #open-je-report .ag-cell {
          display: flex !important;
          font-size: 13px;
          border-right: 1px solid #bfdbfe !important;
        }

        /* ── Entity spanning cell ── */
        #open-je-report .je-entity-span {
          background-color: #ffffff !important;
          border-bottom: 2px solid #2563eb !important;
          border-right: 1px solid #2563eb !important;
          z-index: 1;
          font-size: 13px;
        }

        /* ── Row styling ── */
        #open-je-report .ag-row {
          border-bottom: 1px solid #bfdbfe !important;
        }
        #open-je-report .ag-row-even {
          background-color: #eff6ff !important;
        }
        #open-je-report .ag-row-odd {
          background-color: #ffffff !important;
        }

        /* ── Empty state ── */
        #open-je-report .ag-overlay-no-rows-wrapper {
          font-weight: 700;
          color: #1e3a5f;
          font-size: 14px;
        }
      </style>

      <div class="open-je-wrapper">
        <div id="open-je-report" class="ag-theme-alpine"></div>
      </div>
    `;
  };

  const renderTable = (tableData) => {
    const container = document.getElementById(HTML_CONTAINER_ID);
    if (!container) {
      console.error(
        "CRITICAL ERROR: Could not find the inline HTML container.",
      );
      return;
    }

    expandParentContainers(container);

    if (window.openJeGridApi) {
      window.openJeGridApi.setGridOption("rowData", tableData);
      return;
    }

    injectAgGridUI(container);

    const loadScript = (url, callback) => {
      if (window.agGrid) {
        callback();
        return;
      }
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = url;
      script.onload = () => {
        if (callback) callback();
      };
      document.head.appendChild(script);
    };

    const initAgGrid = () => {
      const gridOptions = {
        columnDefs: getColumnDefs(),
        rowData: tableData,
        autoSizeStrategy: {
          type: "fitGridWidth",
        },

        suppressPaginationPanel: true,
        suppressRowTransform: true,
        enableCellTextSelection: true,
        ensureDomOrder: true,

        defaultColDef: {
          sortable: false,
          resizable: false,
          suppressMovable: true,
        },

        rowHeight: 100,
        headerHeight: 44,
        groupHeaderHeight: 36,

        pagination: true,
        paginationPageSize: 50,
        domLayout: "normal",

        overlayNoRowsTemplate:
          '<span style="font-weight:700;color:#1e3a5f;padding:20px;">' +
          "No pending Journal Entries or Invoices found</span>",
      };

      const gridDiv = document.getElementById("open-je-report");
      window.openJeGridApi = agGrid.createGrid(gridDiv, gridOptions);

      const totals = calculatePinnedTotals(tableData);
      window.openJeGridApi.setGridOption("pinnedBottomRowData", [totals]);
    };

    loadScript(
      "https://unpkg.com/ag-grid-community@31.3.2/dist/ag-grid-community.min.js",
      initAgGrid,
    );
  };

  const exportToExcel = async () => {
    const tableData = _cachedTableData;
    if (!tableData || tableData.length === 0) {
      alert("No data available to export.");
      return;
    }

    await new Promise((resolve) => {
      if (window.ExcelJS) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
      script.onload = resolve;
      document.head.appendChild(script);
    });

    const wb = new window.ExcelJS.Workbook();
    wb.creator = "PCI Open JE Report";
    const ws = wb.addWorksheet("Open JE Report");

    ws.columns = [
      { key: "entityName", width: 38 },
      { key: "journalTranID", width: 16 },
      { key: "journalDate", width: 13 },
      { key: "journalAccount", width: 40 },
      { key: "journalAmount", width: 18 },
      { key: "invoiceTranID", width: 22 },
      { key: "invoiceTotalAmount", width: 18 },
      { key: "invoicePaidAmount", width: 18 },
      { key: "invoiceRemainingAmount", width: 22 },
    ];

    const C = {
      groupHeaderBg: "FFDBEAFE", // #dbeafe — light blue column-group header
      leafHeaderBg: "FF2563EB", // #2563eb — medium blue leaf column header
      totalsBg: "FFDBEAFE", // same as group header for totals row
      entityBorder: "FF2563EB", // blue border that wraps entity spans
      gridLine: "FFBFDBFE", // #bfdbfe — light blue internal grid lines
      negativeFont: "FF721C24", // dark red for negative amounts
      headerText: "FFFFFFFF", // white text on blue leaf headers
      groupText: "FF1E3A5F", // dark navy text on light blue group headers
    };

    const baseFont = { name: "Calibri", size: 10 };
    const headerFont = { name: "Calibri", size: 11, bold: true };
    const centerMid = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    const centerTop = { horizontal: "center", vertical: "top", wrapText: true };

    const thinBorder = (argb = C.gridLine) => ({
      top: { style: "thin", color: { argb } },
      left: { style: "thin", color: { argb } },
      bottom: { style: "thin", color: { argb } },
      right: { style: "thin", color: { argb } },
    });

    const solidFill = (argb) => ({
      type: "pattern",
      pattern: "solid",
      fgColor: { argb },
    });

    const applyHeaderStyle = (cell, bgArgb, textArgb) => {
      cell.font = { ...headerFont, color: { argb: textArgb } };
      cell.fill = solidFill(bgArgb);
      cell.alignment = centerMid;
      cell.border = thinBorder("FF1A4FBA");
    };

    const groupRow = ws.addRow([
      "Customer",
      "Missing Journals",
      "",
      "",
      "",
      "Invoices",
      "",
      "",
      "",
    ]);
    groupRow.height = 28;

    [2, 6].forEach((colIdx) => {
      applyHeaderStyle(groupRow.getCell(colIdx), C.groupHeaderBg, C.groupText);
    });
    [3, 4, 5, 7, 8, 9].forEach((colIdx) => {
      groupRow.getCell(colIdx).fill = solidFill(C.groupHeaderBg);
    });

    const leafRow = ws.addRow([
      "",
      "JE Number",
      "Date",
      "Account",
      "JE Amount",
      "Invoice Number",
      "Total Amount",
      "Paid Amount",
      "Remaining Amount",
    ]);
    leafRow.height = 28;

    for (let col = 2; col <= 9; col++) {
      applyHeaderStyle(leafRow.getCell(col), C.leafHeaderBg, C.headerText);
    }

    ws.mergeCells("A1:A2");
    ws.mergeCells("B1:E1");
    ws.mergeCells("F1:I1");

    const custHeaderCell = ws.getCell("A1");
    applyHeaderStyle(custHeaderCell, C.leafHeaderBg, C.headerText);

    const CURRENCY_FORMAT = "#,##0.00;[Red]-#,##0.00";
    const AMOUNT_COLS = new Set([5, 7, 8, 9]);

    let excelRowNum = 3;
    for (const row of tableData) {
      const journalAmt =
        row.journalAmount !== null ? parseFloat(row.journalAmount) : null;
      const invTotal =
        row.invoiceTotalAmount !== null
          ? parseFloat(row.invoiceTotalAmount)
          : null;
      const invPaid =
        row.invoicePaidAmount !== null
          ? parseFloat(row.invoicePaidAmount)
          : null;
      const invRemain =
        row.invoiceRemainingAmount !== null
          ? parseFloat(row.invoiceRemainingAmount)
          : null;

      const excelRow = ws.addRow([
        row.isFirstRow ? (row.entityName ?? "") : "",
        row.journalTranID ?? "",
        row.journalDate ?? "",
        row.journalAccount ?? "",
        isNaN(journalAmt) || journalAmt === null ? "" : journalAmt,
        row.invoiceTranID ?? "",
        isNaN(invTotal) || invTotal === null ? "" : invTotal,
        isNaN(invPaid) || invPaid === null ? "" : invPaid,
        isNaN(invRemain) || invRemain === null ? "" : invRemain,
      ]);
      excelRow.height = 22;

      for (let col = 1; col <= 9; col++) {
        const cell = excelRow.getCell(col);
        cell.font = { ...baseFont };
        cell.alignment = centerMid;

        if (AMOUNT_COLS.has(col)) {
          const val = parseFloat(cell.value);
          if (!isNaN(val)) {
            cell.numFmt = CURRENCY_FORMAT;
            if (val < 0) {
              cell.font = {
                ...baseFont,
                color: { argb: C.negativeFont },
                bold: true,
              };
            }
          }
        }

        if (col !== 1) {
          cell.border = thinBorder(C.gridLine);
        }
      }

      const entityCell = excelRow.getCell(1);
      entityCell.font = { ...baseFont, bold: true };
      entityCell.border = {
        top: row.isFirstRow
          ? { style: "thin", color: { argb: C.entityBorder } }
          : { style: "thin", color: { argb: "FFFFFFFF" } },
        left: { style: "thin", color: { argb: C.entityBorder } },
        right: { style: "medium", color: { argb: C.entityBorder } },
        bottom: row.isLastRow
          ? { style: "medium", color: { argb: C.entityBorder } }
          : { style: "thin", color: { argb: "FFFFFFFF" } },
      };

      if (row.isFirstRow && row.rowSpan > 1) {
        const startR = excelRowNum;
        const endR = excelRowNum + row.rowSpan - 1;
        ws.mergeCells(`A${startR}:A${endR}`);
        ws.getCell(`A${startR}`).alignment = centerTop;
      }

      excelRowNum++;
    }

    const totals = calculatePinnedTotals(tableData);

    const totalsRow = ws.addRow([
      "TOTAL",
      "",
      "",
      "",
      isNaN(totals.journalAmount) ? 0 : totals.journalAmount,
      "",
      isNaN(totals.invoiceTotalAmount) ? 0 : totals.invoiceTotalAmount,
      isNaN(totals.invoicePaidAmount) ? 0 : totals.invoicePaidAmount,
      isNaN(totals.invoiceRemainingAmount) ? 0 : totals.invoiceRemainingAmount,
    ]);
    totalsRow.height = 26;

    for (let col = 1; col <= 9; col++) {
      const cell = totalsRow.getCell(col);
      cell.font = { ...headerFont, color: { argb: C.groupText } };
      cell.fill = solidFill(C.totalsBg);
      cell.alignment = centerMid;
      cell.border = thinBorder(C.entityBorder);

      if (AMOUNT_COLS.has(col)) {
        const val = parseFloat(cell.value);
        if (!isNaN(val)) {
          cell.numFmt = CURRENCY_FORMAT;
          if (val < 0) {
            cell.font = { ...headerFont, color: { argb: C.negativeFont } };
          }
        }
      }
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dd = pad(now.getDate());
    const mm = pad(now.getMonth() + 1);
    const yyyy = now.getFullYear();
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());
    const filename = `PCI_OPEN_JE_REPORT_${dd}-${mm}-${yyyy}_${hh}-${min}-${ss}.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const pageInit = async () => {
    renderLoader(true);
    const preparedData = await prepareDataForAgGrid();
    _cachedTableData = preparedData;
    renderTable(preparedData);
    renderLoader(false);
  };

  return { pageInit, exportToExcel };
};

define(["N/https"], main);
