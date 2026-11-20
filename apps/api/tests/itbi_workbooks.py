"""Fabricated ITBI workbooks for tests: the real headers, entirely fictitious rows.

Never put rows or extracts of the real Prefeitura files here.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import date
from pathlib import Path

from openpyxl import Workbook

COMMON = [
    "N° do Cadastro (SQL)",
    "Nome do Logradouro",
    "Número",
    "Complemento",
    "Bairro",
    "Referência",
    "CEP",
    "Natureza de Transação",
    "Valor de Transação (declarado pelo contribuinte)",
    "Data de Transação",
    "Valor Venal de Referência",
    "Proporção Transmitida (%)",
    "Valor Venal de Referência (proporcional)",
    "Base de Cálculo adotada",
    "Tipo de Financiamento",
    "Valor Financiado",
    "Cartório de Registro",
    "Matrícula do Imóvel",
    "Situação do SQL",
    "Área do Terreno (m2)",
    "Testada (m)",
    "Fração Ideal",
    "Área Construída (m2)",
    "Uso (IPTU)",
    "Descrição do uso (IPTU)",
    "Padrão (IPTU)",
]
HEADERS = {
    "padrao": [*COMMON, "Descrição do padrão (IPTU)", "ACC (IPTU)"],
    "pardao": [*COMMON, "Descrição do pardão (IPTU)", "ACC (IPTU)", ""],
    "acc_acc": [*COMMON, "ACC (IPTU)", "ACC (IPTU)"],
}


def row(
    *,
    sql: float = 12_345_678.0,  # leading zeros lost, as in the source
    street: str = "R DAS FLORES FICTICIAS",
    number: float = 100.0,
    unit: str = "AP 11",
    neighborhood: str = "VL EXEMPLO",
    reference: str = "COND JARDIM FICTICIO",
    cep: float = 4_000_001.0,
    nature: str = "1.Compra e venda",
    value: float = 500_000.0,
    when: date = date(2026, 1, 10),
    reference_value: float = 400_000.0,
    proportion: float = 100.0,
    financing: str = "",
    financed: float = 0.0,
    land_area: float = 1_000.0,
    ideal_fraction: float = 0.01,
    built_area: float = 100.0,
    use: float = 20.0,
    use_desc: str = "APARTAMENTO EM CONDOMÍNIO (EXIGE FRAÇÃO IDEAL)",
    standard: float = 22.0,
    standard_desc: str = "RESIDENCIAL VERTICAL",
    year: float = 2001.0,
) -> list[object]:
    prop_value = reference_value * proportion / 100
    return [
        sql,
        street,
        number,
        unit,
        neighborhood,
        reference,
        cep,
        nature,
        value,
        when,
        reference_value,
        proportion,
        prop_value,
        max(value, prop_value),
        financing,
        financed,
        "1O CARTORIO FICTICIO",
        999_999.0,
        "Ativo Predial",
        land_area,
        10.0,
        ideal_fraction,
        built_area,
        use,
        use_desc,
        standard,
        standard_desc,
        year,
    ]


def write_workbook(
    path: Path,
    tabs: dict[str, tuple[str, Sequence[Sequence[object]]]],
    *,
    reference_tabs: bool = True,
) -> Path:
    """tabs: name -> (layout, rows); layout "headerless" writes no header row."""
    workbook = Workbook()
    workbook.remove(workbook.active)  # type: ignore[arg-type]
    for name, (layout, rows) in tabs.items():
        sheet = workbook.create_sheet(name)
        if layout != "headerless":
            sheet.append(HEADERS[layout])
        for cells in rows:
            sheet.append(list(cells))
    if reference_tabs:
        workbook.create_sheet("LEGENDA").append(["LEGENDA", ""])
        workbook.create_sheet("EXPLICAÇÕES").append(["CAMPO", "CONCEITO"])
        uses = workbook.create_sheet("Tabela de USOS")
        uses.append(["USO", "DESCRIÇÃO"])
        for code, text in ((10, "RESIDÊNCIA"), (20, "APARTAMENTO"), (24, "GARAGEM")):
            uses.append([code, text])
        standards = workbook.create_sheet("Tabela de PADRÕES")
        for cells in (["PADRÃO", "DESCRIÇÃO"], [22, "RESIDENCIAL VERTICAL"]):
            standards.append(cells)
    workbook.save(path)
    return path
