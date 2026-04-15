import { describe, expect, it } from "vitest";
import { detectProvider, parseStatement } from "./parsers";
import type { ExtractedPdfText } from "./types";

describe("expense import parsers", () => {
  it("detects and parses Santander credit card statements", () => {
    const statement: ExtractedPdfText = {
      pageCount: 2,
      lines: [
        "Tarjeta de crédito Visa Soy Santander",
        "Fecha de Cierre 27/3/2026 Vencimiento 15/04/2026",
        "Período Consultado Marzo 2026",
        "Detalle",
        "Fecha Tarjeta Detalle Importe $ Importe U$S",
        "Saldo Anterior 55808,31 -263,49",
        "26/02/2026 XXXXX-6477 Natura Trix 0,00 1.060,00 0,00",
        "13/03/2026 Pago Automatico Cargo 0,00 -55.808,31 0,00",
        "Cta.Cte.",
        "Saldo final 35.428,95 -263,49",
      ],
      fullText: [
        "Tarjeta de crédito Visa Soy Santander",
        "Fecha de Cierre 27/3/2026 Vencimiento 15/04/2026",
        "Período Consultado Marzo 2026",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("santander_credit_card_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(2);
    expect(parsed?.rows[0].merchantRaw).toBe("Natura Trix");
    expect(parsed?.rows[0].amount).toBe(1060);
    expect(parsed?.rows[1].shouldIgnore).toBe(true);
  });

  it("keeps negative card discounts as negative amounts", () => {
    const statement: ExtractedPdfText = {
      pageCount: 1,
      lines: [
        "Tarjeta de crédito Visa Soy Santander",
        "Fecha de Cierre 27/3/2026 Vencimiento 15/04/2026",
        "Detalle",
        "Fecha Tarjeta Detalle Importe $ Importe U$S",
        "20/03/2026 DESCUENTO PROMOCION 0,00 -120,00 0,00",
        "Saldo final 0,00 0,00",
      ],
      fullText: [
        "Tarjeta de crédito Visa Soy Santander",
        "Fecha de Cierre 27/3/2026 Vencimiento 15/04/2026",
      ].join("\n"),
    };

    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(1);
    expect(parsed?.rows[0].sourceType).toBe("adjustment");
    expect(parsed?.rows[0].shouldIgnore).toBe(false);
    expect(parsed?.rows[0].amount).toBe(-120);
  });

  it("detects and parses Itaú credit card statements", () => {
    const statement: ExtractedPdfText = {
      pageCount: 2,
      lines: [
        "18/03/26",
        "SALDO DEL ESTADO DE CUENTA ANTERIOR 19.573,73 0,00",
        "27 02 26 PAGOS -19.573,73",
        "24 09 25 7039 VIA AQUA SPA 6/12 3722,75",
        "SEGURO DE VIDA SOBRE SALDO 100,38",
        "SALDO CONTADO 11.223,98 0,00",
        "UD. HA GENERADO 238,0 MILLAS ITAU",
      ],
      fullText: [
        "18/03/26",
        "SALDO DEL ESTADO DE CUENTA ANTERIOR 19.573,73 0,00",
        "UD. HA GENERADO 238,0 MILLAS ITAU",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("itau_credit_card_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(3);
    expect(parsed?.rows[0].shouldIgnore).toBe(true);
    expect(parsed?.rows[1].merchantRaw).toBe("VIA AQUA SPA");
    expect(parsed?.rows[2].sourceType).toBe("fee");
  });

  it("detects and parses BBVA credit card statements", () => {
    const statement: ExtractedPdfText = {
      pageCount: 1,
      lines: [
        "Fecha de cierre 26/03/2026 Límite de crédito 200,000.00",
        "Próximo vencimiento 15/05/2026",
        "Fecha Descripción Pesos Dólares",
        "SALDO ANTERIOR 1,254.82 58.03",
        "02/03/2026 SU PAGO U$S 0.00 -58.03",
        "GASTOS ADMINISTRATIVOS U$S 0.00 2.41",
        "TARJETA 2576 - GARAGORRY DIEGO",
        "14/03/2026 MERPAGO*MCDONALDS 276.94 0.00",
        "SALDO CONTADO 1,119.08 83.41",
      ],
      fullText: [
        "Fecha de cierre 26/03/2026",
        "Próximo vencimiento 15/05/2026",
        "Fecha Descripción Pesos Dólares",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("bbva_credit_card_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(3);
    expect(parsed?.rows[0].shouldIgnore).toBe(true);
    expect(parsed?.rows[1].currencyId).toBe("USD");
    expect(parsed?.rows[2].merchantRaw).toBe("MERPAGO*MCDONALDS");
  });

  it("detects and parses Santander checking account statements", () => {
    const statement: ExtractedPdfText = {
      pageCount: 2,
      lines: [
        "Cuenta Corriente Select, 000000402273 UYU 10 - Rondeau",
        "Movimientos",
        "01/03/2026 - 31/03/2026",
        "Saldo inicial 153.476,57",
        "03/03/20 0000003 PAGO DE SERVICIO -1.254,82 145.850,75",
        "26 19548 POR BANRED",
        "SERVICIO DE",
        "PAGOS BANRED ,",
        "TCBBVAMA TARJ:",
        "############8066",
        "16/03/20 TR00815 TRANSFERENCIA 203.200,00 308.556,25",
        "26 70467 RECIBIDA",
        "16/03/20 6074170 COMPRA CON -670,36 307.885,89",
        "26 04337 TARJETA DEBITO",
        "BAIPA PUNTA DEL",
        "ESTE,",
        "MALDONADO",
        "TARJ:",
        "############8066",
        "Saldo final 77.524,82",
      ],
      fullText: [
        "Cuenta Corriente Select, 000000402273 UYU 10 - Rondeau",
        "Movimientos",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("santander_checking_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(3);
    expect(parsed?.rows[0].shouldIgnore).toBe(true);
    expect(parsed?.rows[1].shouldIgnore).toBe(true);
    expect(parsed?.rows[0].amount).toBe(1254.82);
    expect(parsed?.balanceSummary?.openingBalance).toBe(153476.57);
    expect(parsed?.balanceSummary?.closingBalance).toBe(77524.82);
    expect(parsed?.balanceSummary?.currencyId).toBe("UYU");
    expect(parsed?.balanceSummary?.accountHint).toBe("000000402273");
    expect(parsed?.rows[2].merchantRaw).toContain("BAIPA PUNTA DEL ESTE");
  });

  it("detects Santander USD checking statements and strips generic bank boilerplate", () => {
    const statement: ExtractedPdfText = {
      pageCount: 1,
      lines: [
        "Cuenta Corriente Select, 005100370141 USD 10 - Rondeau",
        "Movimientos",
        "Saldo inicial 43.337,10",
        "06/04/20 TT55960 DEBITO 561 OPERACION EN SUPERNET O SMS -1.906,00 41.431,10",
        "26 561 479648TT5596056",
        "1 TRF. PLAZA-",
        "MARCO MANFRINI",
        "06/04/20 0000006 PAGO DE SERVICIO POR BANRED -83,41 41.347,69",
        "26 15191 SERVICIO DE",
        "PAGOS BANRED ,",
        "TCBBVAMA TARJ:",
        "############8066",
        "Saldo final 41.347,69",
      ],
      fullText: [
        "Cuenta Corriente Select, 005100370141",
        "USD",
        "Movimientos",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("santander_checking_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(2);
    expect(parsed?.rows[0].currencyId).toBe("USD");
    expect(parsed?.rows[0].amount).toBe(1906);
    expect(parsed?.balanceSummary?.openingBalance).toBe(43337.1);
    expect(parsed?.balanceSummary?.closingBalance).toBe(41347.69);
    expect(parsed?.balanceSummary?.currencyId).toBe("USD");
    expect(parsed?.rows[0].merchantRaw).toContain("MARCO MANFRINI");
    expect(parsed?.rows[0].merchantRaw).not.toMatch(/SUPERNET|TT55960/);
    expect(parsed?.rows[1].merchantRaw).toBe("TCBBVAMA");
  });

  it("parses Santander checking statements when the debit and balance are split across multiple lines", () => {
    const statement: ExtractedPdfText = {
      pageCount: 1,
      lines: [
        "Santander",
        "Cliente",
        "Garagorry I Diego Javier",
        "Cuenta Moneda Sucursal",
        "Cuenta Corriente Select, 005100444444 USD 10 - Rondeau",
        "Movimientos",
        "01/03/2026 - 31/03/2026",
        "Fecha Tipo Movimiento Descripción Débito Crédito Saldo",
        "Saldo inicial 3.000,00",
        "DEBITO",
        "06/03/20 TT55960",
        "OPERACION EN 1 TRF. PLAZA-",
        "26 561",
        "SUPERNET O SMS",
        "Marco M",
        "479648TT5596056",
        "-1.000,00 2.000,00",
        "1",
        "SERVICIO DE",
        "06/03/20 0000006",
        "PAGO DE SERVICIO",
        "PAGOS BANRED ,",
        "26 15191",
        "POR BANRED",
        "TCBBVAMA TARJ:",
        "############8066",
        "-50,00 1.950,00",
        "Saldo final 1.950,00",
      ],
      fullText: [
        "Cuenta Corriente Select, 005100444444 USD 10 - Rondeau",
        "Movimientos",
        "01/03/2026 - 31/03/2026",
      ].join("\n"),
    };

    expect(detectProvider(statement)).toBe("santander_checking_uy");
    const parsed = parseStatement(statement);
    expect(parsed?.rows).toHaveLength(2);
    expect(parsed?.balanceSummary?.openingBalance).toBe(3000);
    expect(parsed?.balanceSummary?.closingBalance).toBe(1950);
    expect(parsed?.rows[0].amount).toBe(1000);
    expect(parsed?.rows[0].merchantRaw).toContain("TRANSFERENCIA PLAZA");
    expect(parsed?.rows[0].merchantRaw).toContain("Marco M");
    expect(parsed?.rows[0].merchantRaw).not.toMatch(/SUPERNET|TT55960/);
    expect(parsed?.rows[1].merchantRaw).toBe("TCBBVAMA");
  });
});
