import pandas as pd
import json

excel_path = r'c:\Users\lolil\Downloads\Projeto Dentist Management\Prontuário Odontológico  (respostas).xlsx'
xl = pd.ExcelFile(excel_path)

output = {}
for sheet in xl.sheet_names:
    df = pd.read_excel(excel_path, sheet_name=sheet)
    cols_info = []
    for col in df.columns:
        non_null = df[col].dropna()
        sample = str(non_null.iloc[0]) if len(non_null) > 0 else "EMPTY"
        cols_info.append({"name": str(col), "dtype": str(df[col].dtype), "sample": sample[:60], "non_null_count": len(non_null)})
    output[sheet] = {"rows": int(df.shape[0]), "cols": int(df.shape[1]), "columns": cols_info}

with open("excel_analysis.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2, default=str)

print("Saved to excel_analysis.json")
print(f"Sheets: {list(output.keys())}")
for s, info in output.items():
    print(f"\n--- {s}: {info['rows']} rows x {info['cols']} cols ---")
    for c in info['columns']:
        print(f"  {c['name']}: {c['dtype']} ({c['non_null_count']} vals) -> {c['sample'][:50]}")
